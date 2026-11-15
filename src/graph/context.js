import { createContext, useContext } from 'react'

// { results, edgeInfo, ctx } - the evaluated graph plus the shared model/data context.
export const EvalContext = createContext({ results: {}, edgeInfo: {}, ctx: null })

export const useEval = () => useContext(EvalContext)
