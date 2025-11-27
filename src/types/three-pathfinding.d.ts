declare module 'three-pathfinding' {
    import { BufferGeometry, Vector3 } from 'three'

    interface Zone {
        groups: number[][][]
        vertices: number[][]
    }

    export class Pathfinding {
        static createZone(geometry: BufferGeometry): Zone
        setZoneData(zoneID: string, zone: Zone): void
        getGroup(zoneID: string, position: Vector3): number
        getClosestNode(position: Vector3, zoneID: string, groupID: number, checkPolygon?: boolean): Vector3
        findPath(startPosition: Vector3, targetPosition: Vector3, zoneID: string, groupID: number): Vector3[] | null
        clampStep(start: Vector3, end: Vector3, node: any, zoneID: string, groupID: number, endTarget: Vector3): any
    }

    export class PathfindingHelper {
        setPlayerPosition(position: Vector3): void
        setTargetPosition(position: Vector3): void
        setPath(path: Vector3[]): void
        reset(): void
    }
}
