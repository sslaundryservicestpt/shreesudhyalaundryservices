export function POST() {
  return Response.json({error:{code:'CATALOGUE_TEMPLATE_RETIRED',message:'Manage item names in Garment Types.'}}, {status:410,headers:{'Cache-Control':'no-store'}});
}
