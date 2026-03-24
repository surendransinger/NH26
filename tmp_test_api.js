const http = require('http');
function request({path, method='GET', headers={}, body=null}){
  return new Promise((resolv,reject)=>{
    const opts={hostname:'localhost',port:3002,path,method,headers};
    const req=http.request(opts, res=>{
      let data=''; res.on('data', chunk=> data += chunk);
      res.on('end', ()=>{
        try {resolv({status: res.statusCode, body: JSON.parse(data)});} catch(e){resolv({status: res.statusCode, body: data});}
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
(async()=>{
  try {
    const demo = await request({path:'/api/auth/demo', method:'POST', headers:{'Content-Type':'application/json'}, body:{}});
    console.log('demo', demo.status, demo.body);
    if(demo.status === 200 && demo.body.token){
      const ai = await request({path:'/api/ai/query', method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+demo.body.token}, body:{query:'What is my summary'}});
      console.log('ai', ai.status, ai.body);
    }
  } catch (e){ console.error('ERROR', e); }
})();