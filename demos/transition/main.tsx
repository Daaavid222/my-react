import ReactDOM from 'react-dom'

import { useEffect, useState, useTransition, useRef } from 'react'
import TabButton from './TabButton'
import AboutTab from './AboutTab'
import PostsTab from './PostsTab'
import ContactTab from './ContactTab'
import './style.css'

function App() {
	const [isPending, startTransition] = useTransition()
	const [tab, setTab] = useState('about')
	console.log('hello')
	function selectTab(nextTab) {
		startTransition(() => {
			setTab(nextTab)
		})
	}
	useEffect(() => {
		console.log('callback')
		return () => {
			console.log('destroy')
		}
	})
	return (
		<>
			<TabButton isActive={tab === 'about'} onClick={() => selectTab('about')}>
				首页
			</TabButton>
			<TabButton isActive={tab === 'posts'} onClick={() => selectTab('posts')}>
				博客 (render慢)
			</TabButton>
			<TabButton
				isActive={tab === 'contact'}
				onClick={() => selectTab('contact')}
			>
				联系我
			</TabButton>
			<hr />
			{tab === 'about' && <AboutTab />}
			{tab === 'posts' && <PostsTab />}
			{tab === 'contact' && <ContactTab />}
		</>
	)
}

function Demo() {
	const [value, setValue] = useState(123)
	const [count, setCount] = useState(0)
	return (
		<>
			<div
				onClick={() => {
					setValue(111)
				}}
			>
				{value}
			</div>
			<div
				onClick={() => {
					setCount(count + 1)
				}}
			>
				{count}
			</div>
		</>
	)
}

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(<Demo />)
