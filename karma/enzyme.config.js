const enzyme = require('enzyme');
const Adapter = require('@cfaester/enzyme-adapter-react-18').default;

enzyme.configure({
    adapter: new Adapter()
});
