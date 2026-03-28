// Central registry for all app-level tools.
// As we add more tools, the chat layer can import them from one place.

import { calculateRunwayTool } from "./calculate-runway";

export const mcpTools = [calculateRunwayTool]

// Small helper so the app can look up a tool by its public name.
export function getMcpToolByName(name: string) {
    return mcpTools.find((tool) => tool.name === name)
}