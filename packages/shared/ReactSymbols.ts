const supportSymbol = typeof Symbol === 'function' && Symbol.for

const REACT_ELEMENT_TYPE = supportSymbol ? Symbol.for('react.element') : 0xeac7

const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb

export { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE }
