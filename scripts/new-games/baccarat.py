from fractions import Fraction as F
# infinite deck: values 0 (x4/13), 1..9 (1/13 each)
P={v:F(1,13) for v in range(1,10)}; P[0]=F(4,13)
def banker_draws(b,p3):
    if p3 is None: return b<=5
    if b<=2: return True
    if b==3: return p3!=8
    if b==4: return 2<=p3<=7
    if b==5: return 4<=p3<=7
    if b==6: return p3 in (6,7)
    return False
def outcome(p1):
    res={'P':F(0),'B':F(0),'T':F(0)}
    for p2,a in P.items():
     for b1,b in P.items():
      for b2,c in P.items():
        pr=a*b*c; pt=(p1+p2)%10; bt=(b1+b2)%10
        if pt>=8 or bt>=8:
            k='P' if pt>bt else 'B' if bt>pt else 'T'; res[k]+=pr; continue
        if pt<=5:
            for p3,d in P.items():
                pt2=(pt+p3)%10
                if banker_draws(bt,p3):
                    for b3,e in P.items():
                        bt2=(bt+b3)%10; k='P' if pt2>bt2 else 'B' if bt2>pt2 else 'T'; res[k]+=pr*d*e
                else:
                    k='P' if pt2>bt else 'B' if bt>pt2 else 'T'; res[k]+=pr*d
        else:
            if banker_draws(bt,None):
                for b3,e in P.items():
                    bt2=(bt+b3)%10; k='P' if pt>bt2 else 'B' if bt2>pt else 'T'; res[k]+=pr*e
            else:
                k='P' if pt>bt else 'B' if bt>pt else 'T'; res[k]+=pr
    return res
tot={'P':F(0),'B':F(0),'T':F(0)}
best_ev=F(0)
for p1,w in P.items():
    r=outcome(p1)
    for k in tot: tot[k]+=w*r[k]
    evP=2*r['P']+r['T']; evB=F(195,100)*r['B']+r['T']; evT=9*r['T']
    best=max(evP,evB,evT); best_ev+=w*best
    print(p1, {k:round(float(v),4) for k,v in r.items()}, 'P %.4f B %.4f T %.4f'%(evP,evB,evT))
print({k:round(float(v),5) for k,v in tot.items()})
print('RTP player',float(2*tot['P']+tot['T']),'banker',float(F(195,100)*tot['B']+tot['T']),'tie',float(9*tot['T']))
print('best-bet EV knowing first player card',float(best_ev))
