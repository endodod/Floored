import random
from collections import Counter
def run(seed,wu=3,wo=2,wl=0.5,cap=5,n=22):
    r=random.Random(seed); seen=set(); cnt=Counter(); owned=set(); last=set()
    for f in range(1,11):
        pool=[g for g in range(n) if cnt[g]<cap]; pick=[]
        for _ in range(6):
            w=[(wu if g not in seen else 1)*(wo if g in owned else 1)*(wl if g in last else 1) for g in pool]
            g=r.choices(pool,w)[0]; pool.remove(g); pick.append(g)
        for g in pick: cnt[g]+=1
        seen|=set(pick); last=set(pick)
        if f%2==0: owned.add(r.choice(pick))
    return cnt,owned
T=4000;miss=0;mx=Counter();oa=[];na=[]
for i in range(T):
    c,o=run(i); miss+=22-len(c); mx[max(c.values())]+=1
    oa+= [c[g] for g in o]; na+=[c[g] for g in range(22) if g not in o]
print('never offered %.3f'%(miss/T),'max dist',sorted(mx.items()),'owned avg %.2f other avg %.2f'%(sum(oa)/len(oa),sum(na)/len(na)))
