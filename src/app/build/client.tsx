"use client";

import { useState, useEffect } from "react";
import { ServerBuilder } from "@/components/server/server-builder";
import { ServerDeployment } from "@/components/server/server-deployment";
import { MCPTool } from "@/lib/types";

export default function BuildPageClient() {
  const [generatedTools, setGeneratedTools] = useState<MCPTool[]>([]);
  const [description, setDescription] = useState("");
  const [showDeployment, setShowDeployment] = useState(false);

  // Function to receive tools from ServerBuilder component
  const handleToolsGenerated = (tools: MCPTool[], desc: string) => {
    setGeneratedTools(tools);
    setDescription(desc);
    setShowDeployment(true);
  };

  return (
    <div>
      <ServerBuilder onToolsGenerated={handleToolsGenerated} />
      {showDeployment && generatedTools.length > 0 && (
        <ServerDeployment tools={generatedTools} description={description} />
      )}
    </div>
  );
}
