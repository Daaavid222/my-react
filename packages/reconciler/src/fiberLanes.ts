import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler'
import { FiberRootNode } from './fiber'
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig'

export type Lane = number
export type Lanes = number

export const SyncLane = 0b00001
export const InputContinuousLane = 0b00010
export const DefaultLane = 0b00100
export const TransitionLane = 0b01000
export const IdleLane = 0b10000
export const NoLane = 0b0000
export const NoLanes = 0b0000

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB
}

export function requestUpdateLanes() {
	const isTransition = ReactCurrentBatchConfig.transition !== null
	if (isTransition) {
		return TransitionLane
	}
	const currentSchedulePriority = unstable_getCurrentPriorityLevel()
	const lane = schedulerProrityToLane(currentSchedulePriority)
	return lane
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes
}

export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane
}

export function lanesToSchedulePriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes)
	if (lane === SyncLane) {
		return unstable_ImmediatePriority
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority
	}
	return unstable_IdlePriority
}

export function schedulerProrityToLane(priority: number) {
	if (priority === unstable_NormalPriority) {
		return DefaultLane
	}
	if (priority === unstable_UserBlockingPriority) {
		return InputContinuousLane
	}
	if (priority === unstable_ImmediatePriority) {
		return SyncLane
	}
	return NoLane
}
