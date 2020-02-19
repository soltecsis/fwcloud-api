export interface Responsable {
   toResponse(): Object;
}

export function isResponsable(value: any): value is Responsable {
    return (value as Responsable).toResponse !== undefined;
}