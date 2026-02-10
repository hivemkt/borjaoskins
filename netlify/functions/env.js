exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    },
    body: `(function(){
  const _e = {
    u: '${process.env.SUPABASE_URL}',
    k: '${process.env.SUPABASE_KEY}',
    h: '${process.env.ADMIN_HASH}',
    m: '${process.env.MP_PUBLIC_KEY}'
  };
  window.ENV = {
    get SUPABASE_URL() { const v = _e.u; delete _e.u; return v; },
    get SUPABASE_KEY() { const v = _e.k; delete _e.k; return v; },
    get ADMIN_HASH() { const v = _e.h; delete _e.h; return v; },
    get MP_PUBLIC_KEY() { const v = _e.m; delete _e.m; return v; }
  };
  setTimeout(() => { delete window.ENV; }, 10);
})();`
  };
};
