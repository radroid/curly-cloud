"""Rasterize the same 3D surface into the three-panel static hero fallback (needs Bun)."""
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
raw=(ROOT/'public/models/raj-cloud.bin').read_bytes()
_,count,nv,ni=struct.unpack('<4sIII',raw[:16])
packed=np.frombuffer(raw,dtype=np.dtype([('xyz','<i2',(3,)),('normal','i1',(3,)),('brightness','u1')]),count=count,offset=16)
pn=packed['normal'].astype(float)/127
pn/=np.linalg.norm(pn,axis=1,keepdims=True)
points=np.c_[packed['xyz'].astype(float)/65534,pn,packed['brightness'].astype(float)/255]
vertices=np.frombuffer(raw,dtype='<i2',count=nv*3,offset=16+count*10).reshape(-1,3).astype(float)/65534
faces=np.frombuffer(raw,dtype='<u2',count=ni,offset=16+count*10+nv*6).reshape(-1,3)
SIZE=1024
SCALE=SIZE/1.2

def project(v):
    return SIZE/2+v[:,:2]*(1.9/(1.9-v[:,2:3]))*SCALE

# Depth prepass, matching the runtime camera. Reciprocal camera distance interpolates in screen space.
depth=np.full((SIZE,SIZE),-np.inf)
screen=project(vertices)
for f in faces:
    tri=screen[f];d=1/(1.9-vertices[f,2])
    lo=np.maximum(np.floor(tri.min(axis=0)).astype(int),0)
    hi=np.minimum(np.ceil(tri.max(axis=0)).astype(int),SIZE-1)
    if np.any(hi<lo):continue
    yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
    a,b,c=tri
    den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-9:continue
    u=((b[1]-c[1])*(xx+.5-c[0])+(c[0]-b[0])*(yy+.5-c[1]))/den
    v=((c[1]-a[1])*(xx+.5-c[0])+(a[0]-c[0])*(yy+.5-c[1]))/den
    inside=(u>=0)&(v>=0)&(u+v<=1)
    z=u*d[0]+v*d[1]+(1-u-v)*d[2]
    target=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1]
    np.maximum(target,np.where(inside,z,-np.inf),out=target)

q=project(points)
ix=np.clip(q[:,0].astype(int),0,SIZE-1);iy=np.clip(q[:,1].astype(int),0,SIZE-1)
view=np.array([0,0,1.9])-points[:,:3];view/=np.linalg.norm(view,axis=1,keepdims=True)
facing=np.sum(points[:,3:6]*view,axis=1)
visible=(facing>0)&(1/(1.9-points[:,2])+.002>=depth[iy,ix])
alpha=np.clip(points[:,6]*(.3+(points[:,2]+.2)*1.5)*np.minimum(1,(.385-points[:,1])*11),.06,1)
alpha=np.minimum(1,alpha+.08)*.95*visible*np.clip(facing/.16,0,1)

def splat(xy,a,r,core=0):
    keep=np.zeros((SIZE,SIZE))
    reach=int(np.ceil(r+1))
    for dy in range(-reach,reach+1):
        for dx in range(-reach,reach+1):
            ix=np.floor(xy[:,0]).astype(int)+dx;iy=np.floor(xy[:,1]).astype(int)+dy
            d=np.hypot(ix+.5-xy[:,0],iy+.5-xy[:,1])
            cov=np.clip(r+.5-d,0,1)
            if core:
                c=np.clip(core+.5-d,0,1);cov=c+(1-c)*.28*cov
            cov=np.minimum(cov*a,.999)
            ok=(ix>=0)&(ix<SIZE)&(iy>=0)&(iy<SIZE)&(cov>0)
            np.add.at(keep,(iy[ok],ix[ok]),np.log1p(-cov[ok]))
    return 1-np.exp(keep)

code="""
import { readSurface } from './app/components/site/cloud/surface'
import { pickStars } from './app/components/site/cloud/sampler'
import { STARS, PERSONAL } from './app/components/site/cloud/stars'
const {points} = readSurface(await Bun.file('public/models/raj-cloud.bin').arrayBuffer())
console.log(JSON.stringify({stars:pickStars(points, STARS.length+PERSONAL.length),work:STARS.length}))
"""
result=json.loads(subprocess.check_output(['bun','-e',code],cwd=ROOT))
work=np.array(result['stars'][:result['work']]);personal=np.array(result['stars'][result['work']:])
px=SCALE/640
star=lambda s:splat(q[s],visible[s].astype(float),6*px,2.6*px)
a=np.hstack([splat(q,alpha,.8*px),star(work),star(personal)])
a=(np.round(a*15)*255/15).astype(np.uint8)
white=np.where(a>0,255,0).astype(np.uint8)
Image.fromarray(np.dstack([white,white,white,a])).save(ROOT/'public/models/raj-cloud-poster.webp',lossless=True,method=6)
print('Wrote 3D poster')
