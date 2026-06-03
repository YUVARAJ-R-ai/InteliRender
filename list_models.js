const https = require('https');
const options = {
  hostname: 'api.siliconflow.cn',
  path: '/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer sk-crtfvqhbogytsxkbrkpyeilnuvefcvdhelzcfudnjeddnlxo`
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const models = JSON.parse(data).data.map(m => m.id);
      const dsModels = models.filter(m => m.toLowerCase().includes('deepseek'));
      console.log('DeepSeek models:', dsModels);
    } catch(e) { console.log(data); }
  });
});
req.end();
