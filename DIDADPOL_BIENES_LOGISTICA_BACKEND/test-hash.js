const bcrypt = require('bcryptjs');

(async () => {
  const hash = await bcrypt.hash('Admin123', 10);
  console.log(hash);
})();