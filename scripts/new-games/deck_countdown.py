import math,random
fair=1.0
rows=[]
for k in range(2,14):
    left=53-k; bust=3*(k-1); safe=left-bust
    fair*=left/safe
    m=math.floor(0.97*fair*100)/100
    rows.append((k,left,bust,round(bust/left*100,1),m))
for r in rows: print('flip %d: %d left, %d bust (%.1f%%) -> %.2fx'%r)
# verify by simulation: stop at n, check RTP
for n in [2,4,7,10,13]:
    m=dict((r[0],r[4]) for r in rows)[n]
    wins=0;T=200000
    for _ in range(T):
        d=random.sample(range(52),n); ranks=[c%13 for c in d]
        if len(set(ranks))==n: wins+=1
    print(n,'sim RTP',round(wins/T*m,4))
