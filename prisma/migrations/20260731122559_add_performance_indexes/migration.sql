-- CreateIndex
CREATE INDEX "ActionItem_projectId_idx" ON "ActionItem"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_idx" ON "AuditLog"("projectId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionLogItem_projectId_idx" ON "DecisionLogItem"("projectId");

-- CreateIndex
CREATE INDEX "EscalationItem_projectId_idx" ON "EscalationItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectEngagement_projectId_idx" ON "ProjectEngagement"("projectId");

-- CreateIndex
CREATE INDEX "RiskItem_projectId_idx" ON "RiskItem"("projectId");
