import reactConfig from './react.config'
import reactDomConfig from './react-dom.config'
import reactNoopRenderConfig from './react-noop-render.config'

export default () => {
	return [...reactConfig, ...reactNoopRenderConfig, ...reactDomConfig]
}
