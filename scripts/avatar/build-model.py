"""Build Raj's textured 3D bust and its sampled hero surface. No runtime ML dependency.

    python scripts/avatar/build-model.py

Requires numpy, scipy, Pillow, opencv-python. The checked-in landmark fit is the source of
facial depth. Hair, ears, neck, shoulders and unseen rear surfaces are an authored inference.
See docs/avatar/README.md for coordinates, asset format and limitations.
"""
import hashlib
import io
import json
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator
from scipy.ndimage import distance_transform_edt, gaussian_filter, binary_fill_holes
from scipy.spatial import Delaunay, cKDTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
OUT.mkdir(exist_ok=True)
REF = ROOT / 'public/raj-avatar.webp'
FIT = json.loads((Path(__file__).parent / 'face-fit.json').read_text())
assert hashlib.sha256(REF.read_bytes()).hexdigest() == FIT['sha256'], 'Refit landmarks after changing the reference.'
RGB = np.array(Image.open(REF).convert('RGB')) / 255
H, W = RGB.shape[:2]
LM = np.array(FIT['landmarks'])
SCALE = 830 / 926
Y_OFFSET = -11 / 926 - .5
RNG = np.random.default_rng(73)


def at(field, uv):
    p = np.clip((uv * [W-1, H-1]).astype(int), 0, [W-1, H-1])
    return field[p[:, 1], p[:, 0]]


def smooth(a, b, v):
    t = np.clip((v-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def normals(v, f):
    n = np.zeros_like(v)
    cross = np.cross(v[f[:, 1]]-v[f[:, 0]], v[f[:, 2]]-v[f[:, 0]])
    for k in range(3): np.add.at(n, f[:, k], cross)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


# The existing matte was cut from this same cartoon before it was cropped for the avatar.
# Reuse only its silhouette (not its luminance or its old synthetic depth).
matte = np.array(Image.open(ROOT/'public/hero-cloud-src.png').convert('RGBA'))[:,:,3]
my,mx=np.mgrid[0:H,0:W]
mx=np.clip((((mx/(W-1)-.5)*SCALE+.5)*319).round().astype(int),0,319)
my=np.clip(((my/(H-1)*SCALE-11/926)*319).round().astype(int),0,319)
mask=(matte[my,mx]>128).astype(np.uint8)
# Smooth the silhouette enough to avoid narrow folds in the reconstructed sides.
mask=(gaussian_filter(mask.astype(float),3)>.60).astype(np.uint8)
contour = max(cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=len)[:, 0]
border = contour[::4] / [W-1, H-1]
# A regular surface plus the actual landmarks ensures the nose/lids/lips survive triangulation.
gy, gx = np.mgrid[3:H-3:8, 3:W-3:8]
grid = np.c_[gx.ravel()/(W-1), gy.ravel()/(H-1)]
grid = grid[(at(mask, grid)>0) & (at(distance_transform_edt(mask), grid)>4)]
# Avoid near-coincident landmarks and grid points (sliver triangles).
grid = grid[cKDTree(LM[:, :2]).query(grid)[0] > .0025]
uv = np.vstack([border, LM[:, :2], grid])
tri = Delaunay(uv).simplices
centers = uv[tri].mean(axis=1)
tri = tri[at(mask, centers)>0]
# Positive Z faces the viewer in our y-down modelling space.
p = uv[tri]
cross = (p[:,1,0]-p[:,0,0])*(p[:,2,1]-p[:,0,1])-(p[:,1,1]-p[:,0,1])*(p[:,2,0]-p[:,0,0])
tri[cross<0] = tri[cross<0, ::-1]

x, y = uv.T
# Skull, ears, neck and shoulders, smoothly blended outside the fitted facial region.
skull = np.sqrt(np.clip(1-((x-.505)/.247)**2-((y-.32)/.285)**2, 0, 1))
head_z = .205*skull + .007
neck_z = .125*np.sqrt(np.clip(1-((x-.505)/.19)**2, 0, 1))
body_z = .10*np.sqrt(np.clip(1-((x-.5)/.60)**2, 0, 1))
neck_mix = smooth(.61,.79,y)
z = head_z*(1-neck_mix)+neck_z*neck_mix
shirt_mix = smooth(.72,.88,y) * smooth(.09,.20,np.abs(x-.51)) + smooth(.89,.99,y)
z = z*(1-np.clip(shirt_mix,0,1))+body_z*np.clip(shirt_mix,0,1)
# Ear concha/helix relief outside the facial oval.
for ex, ey in [(.309,.491),(.697,.492)]:
    r = ((x-ex)/.033)**2+((y-ey)/.06)**2
    z += .014*np.exp(-r*1.7)-.012*np.exp(-r*5)

# Preserve the detected 3D landmarks exactly, interpolate their facial surface without depth overshoot.
face_interp = LinearNDInterpolator(LM[:,:2], .17-LM[:,2]*1.06)
fz = face_interp(uv)
face = np.isfinite(fz)
z[face] = fz[face]
# Feather outside the face's convex hull rather than creating a vertical mask seam.
nearest_d, nearest_i = cKDTree(LM[:,:2]).query(uv)
blend = (1-smooth(0,.045,nearest_d))*(~face)
z = z*(1-blend)+(.17-LM[nearest_i,2]*1.06)*blend

# Sculpt the reference curls into the outer surface; shading is not used as facial depth.
lum = RGB @ [.299,.587,.114]
hair = (~face) & (y<.58) & (at(lum,uv)<.31)
ridge = at(gaussian_filter(lum, 1.4)-gaussian_filter(lum, 7),uv)
z += hair*(np.clip(ridge,-.14,.14)*.07 + .006*np.sin(x*173+y*62)*np.sin(y*146-x*81))
# A rounded beard edge, without flattening mouth or chin anatomy.
beard = face & (y>.53) & (at(lum,uv)<.27)
z += beard*.0035

# Back of cranium, neck and torso. The back has independent volume and never mirrors the face.
back_head = -.265*np.sqrt(np.clip(1-((x-.505)/.255)**2-((y-.35)/.303)**2,0,1))
back_neck = -.105*np.sqrt(np.clip(1-((x-.505)/.19)**2,0,1))
back_body = -.115*np.sqrt(np.clip(1-((x-.50)/.61)**2,0,1))
bz = back_head*(1-neck_mix)+back_neck*neck_mix
bz = bz*(1-np.clip(shirt_mix,0,1))+back_body*np.clip(shirt_mix,0,1)
# The curl geometry below supplies rear detail; keep the cranium smooth.

# Shared silhouette seam. The lower crop is capped with a thickness, not pinched to a knife edge.
edges = np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1)
unique, counts = np.unique(edges,axis=0,return_counts=True)
seam = unique[counts==1]
edge_ids = np.unique(seam)
nonbottom = edge_ids[y[edge_ids]<.993]
z[nonbottom] = bz[nonbottom] = 0
# Ease the depth at the contour over ~12px; avoid an inflated cardboard rim.
dist = at(distance_transform_edt(mask),uv)/W
edge_ease = np.sqrt(smooth(0,.022,dist))
edge_ease[y>.975]=1
z *= edge_ease
bz *= edge_ease

front = np.c_[(x-.5)*SCALE, y*SCALE+Y_OFFSET, z*SCALE]
back = front.copy(); back[:,2]=bz*SCALE
n = len(front)
verts = np.vstack([front,back])
front_faces = tri
back_faces = tri[:,::-1]+n
# Connect lower rim and any boundary that has nonzero thickness.
side_faces=[]
for a,b in seam:
    if np.linalg.norm(front[a]-back[a])+np.linalg.norm(front[b]-back[b]) < 1e-8: continue
    # Recover the directed front edge so the cap has outward winding.
    for t in tri[np.any(tri==a,axis=1)]:
        if b in t:
            if t[(np.where(t==a)[0][0]+1)%3] != b: a,b=b,a
            break
    side_faces.extend([[b,a,a+n],[b,a+n,b+n]])
side_faces=np.array(side_faces,dtype=int).reshape(-1,3)
faces=np.vstack([front_faces,back_faces,side_faces])
normal=normals(verts,faces)
# Average normals along the welded outline for a continuous rounded silhouette.
for i in nonbottom:
    avg=normal[i]+normal[i+n]; avg/=max(np.linalg.norm(avg),1e-9)
    normal[i]=normal[i+n]=avg

# The back uses plausible colors instead of reflecting the portrait around the rear.
back_rgb=np.tile([.86,.86,.72],(n,1))
stripe=(np.mod((x-.5)*29 + .15*np.sin(y*9),1)<.20)
back_rgb[stripe]=[.15,.29,.22]
back_hair=y<.64
back_rgb[back_hair]=np.c_[np.ones(sum(back_hair))*.075,np.ones(sum(back_hair))*.078,np.ones(sum(back_hair))*.071]
neck=(y>=.60)&(np.abs(x-.51)<.17)&(y<.735)
back_rgb[neck]=[.66,.36,.19]
# Keep edge color continuous into the side, then transition to inferred rear material.
edge_color=at(RGB,uv)
mix=np.zeros_like(dist)
back_rgb=back_rgb*(1-mix[:,None])+edge_color*mix[:,None]
colors=np.vstack([at(RGB,uv),back_rgb])

# Volumetric curl locks continue around the sides/back of the scalp. Each lock is an
# irregular tapered spiral tube; these remain silhouettes and highlights under rotation.
all_uv=np.vstack([uv,uv])
curl_vertices=[];curl_faces=[];curl_colors=[]
center=np.array([.005*SCALE,.35*SCALE+Y_OFFSET,-.006])
radii=np.array([.237,.286,.250])*SCALE
for band in range(1,18):
    theta=.12+band*.155
    for step in range(max(5,int(34*np.sin(theta)))):
        phi=step*2*np.pi/max(5,int(34*np.sin(theta)))+RNG.uniform(-.12,.12)
        direction=np.array([np.sin(theta)*np.cos(phi),-np.cos(theta),np.sin(theta)*np.sin(phi)])
        base=center+radii*direction
        # Preserve the source's forelocks and keep ears/jaw free of extra locks.
        if base[2]>.025 or base[1]>.055:continue
        outward=direction/radii;outward/=np.linalg.norm(outward)
        tangent=np.cross(outward,[0,1,0]);tangent/=max(np.linalg.norm(tangent),1e-8)
        bitangent=np.cross(outward,tangent)
        radius=RNG.uniform(.014,.023)
        phase=RNG.uniform(0,6.28)
        start=len(curl_vertices)
        path=[]
        for j in range(17):
            t=j/16
            a=phase+t*np.pi*2.6
            r=radius*(1-.65*t)
            path.append(base+outward*(.008+.015*np.sin(t*np.pi))+tangent*np.cos(a)*r+bitangent*np.sin(a)*r)
        for j,q in enumerate(path):
            along=path[min(j+1,16)]-path[max(j-1,0)];along/=np.linalg.norm(along)
            side=np.cross(along,outward);side/=np.linalg.norm(side)
            up=np.cross(side,along)
            tube=.007*(1-.60*j/16)
            for k in range(6):
                a=k*np.pi/3
                curl_vertices.append(q+tube*(np.cos(a)*side+np.sin(a)*up))
                shade=RNG.uniform(.055,.09)
                curl_colors.append([shade*.95,shade,shade*.94])
        for j in range(16):
            for k in range(6):
                a=start+j*6+k;b=start+j*6+(k+1)%6;c=start+(j+1)*6+k;d=start+(j+1)*6+(k+1)%6
                curl_faces.extend([[a,b,c],[b,d,c]])
cv=np.array(curl_vertices);cf=np.array(curl_faces)
cn=normals(cv,cf)
# Orient each tube consistently outwards (the parameterization is clockwise).
cf=cf[:,::-1];cn=-cn
back_faces=np.vstack([back_faces,cf+len(verts)])
verts=np.vstack([verts,cv]);normal=np.vstack([normal,cn]);colors=np.vstack([colors,curl_colors])
all_uv=np.vstack([all_uv,np.zeros((len(cv),2))])
faces=np.vstack([front_faces,back_faces,side_faces])
assert len(verts)<65536, 'The hero uses WebGL1-compatible uint16 indices.'

# glTF 2.0: independent portrait and rear materials, embedded texture, no external URLs.
blob=bytearray(); views=[]; accessors=[]
def view(data,target=None):
    while len(blob)%4: blob.append(0)
    v={'buffer':0,'byteOffset':len(blob),'byteLength':len(data)}
    if target: v['target']=target
    views.append(v);blob.extend(data);return len(views)-1

def accessor(data,typ,component=5126,target=34962):
    data=np.asarray(data,dtype='<f4' if component==5126 else '<u2')
    a={'bufferView':view(data.tobytes(),target),'componentType':component,'count':len(data),'type':typ}
    if typ!='SCALAR':a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
    accessors.append(a);return len(accessors)-1

gv=verts*[1,-1,1];gn=normal*[1,-1,1]
pos=accessor(gv,'VEC3');norm=accessor(gn,'VEC3')
tex=accessor(all_uv,'VEC2')
# COLOR_0 is linear RGB in glTF; texture remains sRGB.
linear=np.where(colors<=.04045,colors/12.92,((colors+.055)/1.055)**2.4)
col=accessor(linear,'VEC3')
front_idx=accessor(front_faces[:,::-1].ravel(),'SCALAR',5123,34963)
rear_idx=accessor(np.vstack([back_faces,side_faces])[:,::-1].ravel(),'SCALAR',5123,34963)
img=io.BytesIO();Image.open(REF).convert('RGB').save(img,format='JPEG',quality=94)
image_view=view(img.getvalue())
gltf={'asset':{'version':'2.0','generator':'Raj portrait surface reconstruction; scripts/avatar/build-model.py'},
 'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Raj_Bust','mesh':0}],
 'meshes':[{'name':'Raj_Bust','primitives':[
 {'attributes':{'POSITION':pos,'NORMAL':norm,'TEXCOORD_0':tex},'indices':front_idx,'material':0},
 {'attributes':{'POSITION':pos,'NORMAL':norm,'COLOR_0':col},'indices':rear_idx,'material':1}]}],
 'materials':[{'name':'Portrait','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.88}},
 {'name':'Inferred_Back','pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.88}}],
 'textures':[{'sampler':0,'source':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
 'images':[{'bufferView':image_view,'mimeType':'image/jpeg'}],
 'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':accessors,
 'extras':{'reference':FIT['source'],'referenceSha256':FIT['sha256'],'faceLandmarks':468,'rigged':False,
 'notes':'Stylized single-view reconstruction; unseen surfaces are inferred. +Y up, +Z forward. Shared geometry with raj-cloud.bin.'}}
while len(blob)%4:blob.append(0)
j=json.dumps(gltf,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
glb=struct.pack('<III',0x46546c67,2,28+len(j)+len(blob))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(blob),0x004e4942)+blob
(OUT/'raj-bust.glb').write_bytes(glb)

# Sample the actual triangles, not image pixels lifted onto an ellipse. Uniform barycentric
# positions with an edge/curvature emphasis retain the smile, eyes, beard and curls.
p=verts[faces]
area=np.linalg.norm(np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]),axis=1)/2
candidate_count=240000
chosen=RNG.choice(len(faces),candidate_count,p=area/area.sum())
t=faces[chosen];r=np.sqrt(RNG.random(candidate_count));s=RNG.random(candidate_count)
bary=np.c_[1-r,r*(1-s),r*s]
points=np.einsum('ij,ijk->ik',bary,verts[t]);pn=np.einsum('ij,ijk->ik',bary,normal[t]);pn/=np.maximum(np.linalg.norm(pn,axis=1,keepdims=True),1e-9)
puv=np.einsum('ij,ijk->ik',bary,all_uv[t])
front_sample=chosen<len(front_faces)
grad=np.hypot(*np.gradient(gaussian_filter(lum,1)))
ink=at(lum,puv);detail=np.clip(at(grad,puv)*22,0,1)
# More budget for the face, less for the shirt and back, but every view has real surface points.
weights=np.where(front_sample,.20+detail*3.8+np.where(ink<.28,.45,0),.25)
weights*=np.where(puv[:,1]<.72,1.6,.42)
selected=RNG.choice(candidate_count,18000,replace=False,p=weights/weights.sum())
points=points[selected];pn=pn[selected];puv=puv[selected];front_sample=front_sample[selected]
brightness=np.where(front_sample & ((ink[selected]<.3)|(detail[selected]>.24)),1,.60)
# Quantized transport: 1/65534 model units is under .02px at a 1000px figure.
# glTF stays full precision; the hero expands this compact asset once at load time.
assert np.max(np.abs(verts)) < .5 and np.max(np.abs(points)) < .5, 'Quantized coordinate range exceeded.'
header=struct.pack('<4sIII',b'RJC2',len(points),len(verts),faces.size)
point_type=np.dtype([('xyz','<i2',(3,)),('normal','i1',(3,)),('brightness','u1')])
packed=np.empty(len(points),dtype=point_type)
packed['xyz']=np.round(points*65534).astype('<i2')
packed['normal']=np.round(pn*127).astype('i1')
packed['brightness']=np.round(brightness*255).astype('u1')
(OUT/'raj-cloud.bin').write_bytes(header+packed.tobytes()+np.round(verts*65534).astype('<i2').tobytes()+faces.astype('<u2').tobytes())
metadata={'vertices':len(verts),'triangles':len(faces),'points':len(points),'glbBytes':len(glb),
 'cloudBytes':(OUT/'raj-cloud.bin').stat().st_size,'bounds':{'min':gv.min(axis=0).tolist(),'max':gv.max(axis=0).tolist()}}
(OUT/'raj-bust.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps(metadata,indent=2))
