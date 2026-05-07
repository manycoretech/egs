const BUFFER_CAPACITY = 300;
export class ValueCounter{
    private sum: number = 0;
    private buffer: number[];
    private cursor: number = 0;
    private capacity: number = 0;

    constructor() {
        this.capacity = BUFFER_CAPACITY;
        this.buffer = (new Array(BUFFER_CAPACITY)).fill(0);
    }

    public toJSON() {
        return JSON.stringify(this.buffer);
    }

    public set(value: number) {
        this.cursor++;
        this.sum -= this.buffer[(this.cursor) % this.capacity];
        this.buffer[(this.cursor) % this.capacity] = value;
        this.sum += value;
    }

    public clear() {
        this.sum = 0;
        this.cursor = 0;
        this.buffer.fill(0);
    }

    public getLast(): number{
        return this.buffer[(this.cursor) % this.capacity];
    }

    public getAverage(): number {
        return this.sum / this.capacity;
    }
}
