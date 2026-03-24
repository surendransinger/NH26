const http = require('http');

function request({path, method='GET', headers={}, body=null}){
  return new Promise((resolve,reject)=>{
    const opts={hostname:'localhost',port:3002,path,method,headers};
    const req=http.request(opts, res=>{
      let data=''; res.on('data', chunk=> data += chunk);
      res.on('end', ()=>{
        try {resolve({status: res.statusCode, body: JSON.parse(data)});} catch(e){resolve({status: res.statusCode, body: data});}
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAll(){
  console.log('🧪 Testing Re Re Mail Backend...');

  try {
    // 1. Demo auth
    console.log('1. Testing /api/auth/demo...');
    const demo = await request({path:'/api/auth/demo', method:'POST', headers:{'Content-Type':'application/json'}, body:{}});
    if(demo.status !== 200 || !demo.body.token){
      throw new Error('Demo auth failed: ' + JSON.stringify(demo));
    }
    const token = demo.body.token;
    console.log('✅ Demo auth OK, token:', token.slice(0,10)+'...');

    // 2. AI query
    console.log('2. Testing /api/ai/query...');
    const ai = await request({path:'/api/ai/query', method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:{query:'What is my summary'}});
    if(ai.status !== 200 || !ai.body.reply){
      throw new Error('AI query failed: ' + JSON.stringify(ai));
    }
    console.log('✅ AI query OK, reply:', ai.body.reply.slice(0,50)+'...');

    // 3. Get linked accounts
    console.log('3. Testing /api/accounts (GET)...');
    const accounts = await request({path:'/api/accounts', method:'GET', headers:{'Authorization':'Bearer '+token}});
    if(accounts.status !== 200 || !Array.isArray(accounts.body)){
      throw new Error('Get accounts failed: ' + JSON.stringify(accounts));
    }
    console.log('✅ Get accounts OK, count:', accounts.body.length);

    // 4. Link account
    console.log('4. Testing /api/accounts/link (POST)...');
    const link = await request({path:'/api/accounts/link', method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body:{provider:'gmail', provider_email:'test@gmail.com'}});
    if(link.status !== 200 || !link.body.id){
      throw new Error('Link account failed: ' + JSON.stringify(link));
    }
    console.log('✅ Link account OK, id:', link.body.id);

    // 5. Get mails
    console.log('5. Testing /api/mails (GET)...');
    const mails = await request({path:'/api/mails', method:'GET', headers:{'Authorization':'Bearer '+token}});
    if(mails.status !== 200 || !Array.isArray(mails.body)){
      throw new Error('Get mails failed: ' + JSON.stringify(mails));
    }
    console.log('✅ Get mails OK, count:', mails.body.length);

    // 6. Get stats
    console.log('6. Testing /api/mails/stats...');
    const stats = await request({path:'/api/mails/stats', method:'GET', headers:{'Authorization':'Bearer '+token}});
    if(stats.status !== 200 || typeof stats.body !== 'object'){
      throw new Error('Get stats failed: ' + JSON.stringify(stats));
    }
    console.log('✅ Get stats OK, unread:', stats.body.inbox_unread);

    console.log('\n🎉 All backend tests PASSED! Re Re Mail is fully operational.');

  } catch (e){
    console.error('❌ Test FAILED:', e.message);
    process.exit(1);
  }
}

testAll();