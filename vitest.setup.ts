// This suite uses React.act with a jsdom concurrent root. Declare that test
// environment explicitly; missing act() around updates still warns normally.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
