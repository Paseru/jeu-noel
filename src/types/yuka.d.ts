declare module 'yuka' {
  namespace YUKA {
    class NavMesh {
      findPath(from: Vector3, to: Vector3): Vector3[];
      getClosestRegion(point: Vector3): { centroid: Vector3 } | null;
    }
    class NavMeshLoader {
      load(path: string): Promise<NavMesh>;
    }
    class Vector3 {
      constructor(x?: number, y?: number, z?: number);
      x: number; y: number; z: number;
    }
  }
  const yuka: typeof YUKA;
  export = yuka;
}
