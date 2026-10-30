import math, itertools
from fractions import Fraction as Fr
def f2(x): return math.floor(x*100+1e-9)/100
deck=[(r,s) for r in range(2,15) for s in range(4)]
best=(0,None); tot_ev=Fr(0)
def step_mults(rem, c1=None, c2=None, step=1):
    n=len(rem)
    if step==1: return {'red':1.94,'black':1.94}
    if step==2:
        v=c1[0];out={}
        hi=sum(1 for c in rem if c[0]>v); lo=sum(1 for c in rem if c[0]<v)
        if hi: out['higher']=(f2(n/hi),hi)
        if lo: out['lower']=(f2(n/lo),lo)
        return out
maxm=0;arg=None
for c1 in deck:
    rem1=[c for c in deck if c!=c1]; v=c1[0]
    for g2 in ('higher','lower'):
        win2=[c for c in rem1 if (c[0]>v if g2=='higher' else c[0]<v)]
        if not win2: continue
        m2=f2(51/len(win2))
        for c2 in win2:
            rem2=[c for c in rem1 if c!=c2]; lo,hi=sorted((v,c2[0]))
            for g3 in ('inside','outside'):
                win3=[c for c in rem2 if (lo<c[0]<hi if g3=='inside' else (c[0]<lo or c[0]>hi))]
                if not win3: continue
                m3=f2(50/len(win3))
                rem3=[c for c in rem2 if c not in win3[:0]]
                for c3 in win3:
                    rem3=[c for c in rem2 if c!=c3]
                    for s in range(4):
                        k=sum(1 for c in rem3 if c[1]==s)
                        m4=f2(49/k)
                        m=round(1.94*m2*m3*m4,2)
                        if m>maxm: maxm=m;arg=(c1,g2,c2,g3,c3,s,m2,m3,m4)
print(maxm,arg)
