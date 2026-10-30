import itertools
TOT={4:70,5:35,6:21,7:14,8:10,9:8.4,10:7.75,11:7.75,12:8.4,13:10,14:14,15:21,16:35,17:70}
rolls=list(itertools.product(range(1,7),repeat=3))
def pay(bet,r):
    t=sum(r);trip=r[0]==r[1]==r[2]
    if bet=='small': return 2 if 4<=t<=10 and not trip else 0
    if bet=='big': return 2 if 11<=t<=17 and not trip else 0
    if bet=='any-triple': return 35 if trip else 0
    if bet.startswith('total-'): return TOT[int(bet[6:])] if t==int(bet[6:]) else 0
    if bet.startswith('double-'): return 13 if r.count(int(bet[7:]))>=2 else 0
    if bet.startswith('single-'):
        c=r.count(int(bet[7:])); return {0:0,1:2,2:3,3:15}[c]
bets=['small','big','any-triple']+[f'total-{t}' for t in range(4,18)]+[f'double-{k}' for k in range(1,7)]+[f'single-{k}' for k in range(1,7)]
for b in bets: print(b, round(sum(pay(b,r) for r in rolls)/216*100,2))
