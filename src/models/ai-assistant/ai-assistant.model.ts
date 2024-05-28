//import { Model } from "openai";
import { PrimaryGeneratedColumn } from "typeorm";

export class AIRequest {
    /**
       * The model identifier, which can be referenced in the API endpoints.
       */
    id: string;

    /**
     * A list of chat completion choices. Can contain more than one elements if n is greater than 1. Can also be empty for the last chunk if you set stream_options: {"include_usage": true}.
     */
    choices: string[]

    /**
     * The Unix timestamp (in seconds) when the model was created.
     */
    created: number;

    /**
     * The model to generate the completion.
     */
    model: string

    /**
     * This fingerprint represents the backend configuration that the model runs with. 
     * Can be used in conjunction with the seed request parameter to understand when backend changes have been made that might impact determinism.
     */
    system_fingerprint: string


    /**
     * The object type, which is always "chat.completion.chunk".
     */
    object: 'chat.completion.chunk';
    //object: string

    /**
     * The organization that owns the model.
     */
    owned_by: string;

    /**
     * An optional field that will only be present when you set stream_options: {"include_usage": true} in your request. 
     * When present, it contains a null value except for the last chunk which contains the token usage statistics for the entire request.
     */
    usage: {
        "include_usage": boolean
    }
}