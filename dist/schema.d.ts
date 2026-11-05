/**
 * The `ask_user_question` argument shape: the typebox schema the tool
 * declares, and `prepareAskArguments` for models that stringify the
 * array. The limits (1–4 questions, 2–4 options, header ≤ 16, label
 * ≤ 60) are the ones the design keeps from rpiv so prompting habits
 * carry over (spec §7.1); rules a schema cannot express live in
 * `validate.ts`.
 */
import { Type, type Static } from "@earendil-works/pi-ai";
export declare const AskOptionSchema: Type.TObject<{
    label: Type.TString;
    description: Type.TString;
    preview: Type.TOptional<Type.TString>;
}>;
export declare const AskQuestionSchema: Type.TObject<{
    question: Type.TString;
    header: Type.TString;
    multiSelect: Type.TOptional<Type.TBoolean>;
    options: Type.TArray<Type.TObject<{
        label: Type.TString;
        description: Type.TString;
        preview: Type.TOptional<Type.TString>;
    }>>;
}>;
export declare const AskParamsSchema: Type.TObject<{
    questions: Type.TArray<Type.TObject<{
        question: Type.TString;
        header: Type.TString;
        multiSelect: Type.TOptional<Type.TBoolean>;
        options: Type.TArray<Type.TObject<{
            label: Type.TString;
            description: Type.TString;
            preview: Type.TOptional<Type.TString>;
        }>>;
    }>>;
}>;
export type AskOption = Static<typeof AskOptionSchema>;
export type AskQuestion = Static<typeof AskQuestionSchema>;
export type AskParams = Static<typeof AskParamsSchema>;
/**
 * Models occasionally send the array as a JSON string; normalize that to
 * parsed form. Anything else passes through unchanged. Pure.
 */
export declare function prepareAskArguments(args: unknown): AskParams;
