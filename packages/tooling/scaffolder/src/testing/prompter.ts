import { cancelled, type Cancelled, type Prompter } from "../cli/prompter.js"

export type ScriptedAnswer =
  | string
  | string[]
  | boolean
  | Cancelled
  | ((question: AskedQuestion) => string | string[] | boolean | Cancelled)

export interface AskedQuestion {
  kind: "select" | "multiselect" | "confirm" | "text" | "password"
  message: string
  options?: string[]
  initial?: unknown
}

/** A prompter that answers from a script and records every question, for wizard tests. */
export function scriptedPrompter(script: ScriptedAnswer[]): {
  prompter: Prompter
  asked: AskedQuestion[]
  notes: string[]
} {
  const asked: AskedQuestion[] = []
  const notes: string[] = []
  const next = (question: AskedQuestion) => {
    asked.push(question)
    const answer = script.shift()
    if (answer === undefined) {
      throw new Error(`Unexpected question: ${question.message}`)
    }
    return typeof answer === "function" ? answer(question) : answer
  }
  const ofType = <T>(question: AskedQuestion, check: (value: unknown) => value is T): T | Cancelled => {
    const value = next(question)
    if (value === cancelled || check(value)) {
      return value
    }
    throw new Error(`Scripted answer ${JSON.stringify(value)} doesn't fit "${question.message}"`)
  }
  const isString = (value: unknown): value is string => typeof value === "string"
  const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"
  const isList = (value: unknown): value is string[] => Array.isArray(value)
  return {
    asked,
    notes,
    prompter: {
      select: async (question) =>
        ofType(
          {
            kind: "select",
            message: question.message,
            options: question.options.map((option) => option.value),
            initial: question.initialValue
          },
          isString
        ),
      multiselect: async (question) =>
        ofType(
          {
            kind: "multiselect",
            message: question.message,
            options: question.options.map((option) => option.value),
            initial: question.initialValues
          },
          isList
        ),
      confirm: async (question) =>
        ofType({ kind: "confirm", message: question.message, initial: question.initialValue }, isBoolean),
      text: async (question) => {
        const value = ofType({ kind: "text", message: question.message, initial: question.initialValue }, isString)
        if (value !== cancelled && question.validate?.(value)) {
          throw new Error(`Scripted answer "${value}" fails validation: ${question.validate(value)}`)
        }
        return value
      },
      password: async (question) => ofType({ kind: "password", message: question.message }, isString),
      note: (message) => {
        notes.push(message)
      }
    }
  }
}
