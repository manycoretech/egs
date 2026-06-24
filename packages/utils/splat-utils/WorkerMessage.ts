export enum TaskType {
    SortSplats = 'SortSplats',
}

export enum TaskStatus {
    Success,
    Fail,
}

interface IBasicMessage {
    [key: string]: {
        send: unknown;
        receive: unknown;
    };
}

export interface IMessage extends IBasicMessage {
    [TaskType.SortSplats]: {
        send: { count: number; sorting: Uint16Array | Uint32Array; ordering: Uint32Array };
        receive: { activeCount: number; sorting: Uint16Array | Uint32Array; ordering: Uint32Array };
    };
}

export interface SendMessage<T extends TaskType> {
    taskType: T;
    payload: IMessage[T]['send'];
}
export type ReceiveMessage<T extends TaskType> =
    | {
          status: TaskStatus.Success;
          payload: IMessage[T]['receive'];
      }
    | {
          status: TaskStatus.Fail;
          payload: string;
      };
