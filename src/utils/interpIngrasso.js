const TAB = [
  { w: 400, min: 2.5, opt: 4.5 },
  { w: 500, min: 3.0, opt: 5.0 },
  { w: 600, min: 3.5, opt: 5.5 },
  { w: 700, min: 4.0, opt: 6.0 },
  { w: 800, min: 4.5, opt: 6.5 },
  { w: 900, min: 5.0, opt: 7.0 },
  { w: 1000, min: 5.5, opt: 7.5 },
]

export function interpIngrasso(weight){
  if (weight <= 400) return { min: 2.5, adeg: 3.7, opt: 4.5 }
  if (weight >= 1000) return { min: 5.5, adeg: 6.5, opt: 7.5 }
  let low = TAB[0]
  for (let i=1;i<TAB.length;i++){
    const hi = TAB[i]
    if (weight <= hi.w){
      const t = (weight - low.w)/(hi.w - low.w)
      const min = low.min + t*(hi.min - low.min)
      const opt = low.opt + t*(hi.opt - low.opt)
      const adeg = (min + opt)/2
      return { min, adeg, opt }
    }
    low = hi
  }
  return { min: 3.5, adeg: 4.5, opt: 5.5 }
}
