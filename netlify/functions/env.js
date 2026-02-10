exports.handler = async function(event, context) {
  const e = Buffer.from([
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
    process.env.ADMIN_HASH,
    process.env.MP_PUBLIC_KEY
  ].join('|')).toString('base64');
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    },
    body: `(function(){const d=atob('${e}').split('|');window.ENV={get SUPABASE_URL(){return d[0]},get SUPABASE_KEY(){return d[1]},get ADMIN_HASH(){return d[2]},get MP_PUBLIC_KEY(){return d[3]}};setTimeout(()=>{delete window.ENV},10);})();`
  };
};
