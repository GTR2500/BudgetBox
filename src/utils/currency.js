export function currency(n, dec=0){
  if (Number.isNaN(n)) return '€ 0'
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec })
}
