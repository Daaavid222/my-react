import {
	createContainer,
	updateContainer
} from 'reconciler/src/fiberReconciler'
import { ReactElementType } from 'shared/ReactTypes'
import { Container, Instance } from './hostConfig'
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols'
import * as Scheduler from 'scheduler'

let idCounter = 0

export function createRoot() {
	const container = {
		rootID: idCounter++,
		children: []
	}
	// @ts-ignore
	const root = createContainer(container)

	function getChildren(parent: Instance | Container) {
		if (parent) {
			return parent.children
		}
		return null
	}

	return {
		_Scheduler: Scheduler,
		render(element: ReactElementType) {
			return updateContainer(element, root)
		},
		getChildren() {
			// @ts-ignore
			return getChildren(container)
		},
		getChildrenToJSX() {
			// @ts-ignore
			return getChildrenToJSX(container)
		}
	}
}

function getChildrenToJSX(root: Container) {
	const children = childToJSX(root.children)
	if (Array.isArray(children)) {
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type: REACT_FRAGMENT_TYPE,
			key: null,
			ref: null,
			props: {
				children
			},
			__mark: 'David'
		}
	}
}

function childToJSX(child: any): any {
	if (typeof child === 'string' || typeof child === 'number') {
		return child
	}

	if (Array.isArray(child)) {
		if (child.length === 0) {
			return null
		}

		if (child.length === 1) {
			return childToJSX(child[0])
		}
		const children = child.map(childToJSX)

		if (
			children.every(
				(child) => typeof child === 'string' || typeof child === 'number'
			)
		) {
			return children.join('')
		}

		return children
	}

	if (Array.isArray(child.children)) {
		const instance: Instance = child
		const children = childToJSX(instance.children)
		const props = instance.props

		if (children !== null) {
			props.children = children
		}

		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type: instance.type,
			key: null,
			ref: null,
			props,
			__mark: 'David'
		}
	}

	return child.text
}
