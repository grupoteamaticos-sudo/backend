let io = null;

const setSocketInstance = (socketInstance) => {
  io = socketInstance;
};

const getSocketInstance = () => io;

module.exports = {
  setSocketInstance,
  getSocketInstance,
};