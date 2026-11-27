export type SortStorage = {
    sorting: Float32Array;
    ordering: Uint32Array;
    region?: number;
};

export enum TaskType {
    Init = 'Init',
    Alloc = 'Alloc',
    Update = 'Update',
    Sort = 'Sort',
    Release = 'Release',
}

export enum TaskStatus {
    Success,
    Fail,
}

export interface IMessage {
    [TaskType.Init]: {
        send: { moduleUrl: string; shared: boolean };
        receive: never;
    };
    [TaskType.Alloc]: {
        send: { capacity: number; storage?: SortStorage };
        receive: SortStorage | undefined;
    };
    [TaskType.Update]: {
        send: { storage: SortStorage; changed: Array<{ start: number; end: number }> };
        receive: never;
    };
    [TaskType.Sort]: {
        send: {
            storage: SortStorage;
            count: number;
            cameraPosition: number[];
            cameraDirection: number[];
            radial: boolean;
            depthBias: number;
        };
        receive: { activeCount: number };
    };
    [TaskType.Release]: {
        send: { region: number };
        receive: never;
    };
}

export type SendMessage = { [Task in TaskType]: { taskType: Task; payload: IMessage[Task]['send'] } }[TaskType];
export type ReceiveMessage<T extends TaskType> = (
    | {
          status: TaskStatus.Success;
          payload: IMessage[T]['receive'];
      }
    | {
          status: TaskStatus.Fail;
          payload: string;
      }
) & {
    returned?: SortStorage;
};
