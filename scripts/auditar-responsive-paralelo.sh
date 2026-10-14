#!/bin/sh
# Corre scripts/auditar-responsive.ts en partes (rol y ancho), de a 3 a la vez (más satura el
# servidor local), y une el resultado con scripts/unir-responsive.ts.
#   sh scripts/auditar-responsive-paralelo.sh antes [http://localhost:3100]
E=${1:-auditoria}; B=${2:-http://localhost:3100}
rm -f tmp/responsive-$E-*.json tmp/responsive-$E-*.log; rm -rf tmp/capturas/responsive/$E-*
{
  for a in 360 390 430 1440,1920; do echo "direccion $a"; done
  for r in daniela claudio compras deposito administracion; do echo "$r 360,390,430,1440,1920"; done
} | xargs -P 3 -L 1 sh -c 'ANCHOS=$1 npx tsx scripts/auditar-responsive.ts "'"$E"'-$0-$(echo $1 | tr , _)" "'"$B"'" "$0" > "tmp/responsive-'"$E"'-$0-$(echo $1 | tr , _).log" 2>&1'
grep -h "se colgó\|Error" tmp/responsive-$E-*.log
npx tsx scripts/unir-responsive.ts "$E"
