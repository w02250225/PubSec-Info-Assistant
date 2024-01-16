param name string
param location string = resourceGroup().location
param kvAccessObjectId string
@secure()
param openaiServiceKey string
param useExistingAOAIService bool
param tags object = {}

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    enabledForTemplateDeployment: true
    createMode: 'default'
    sku: {
      name: 'standard'
      family: 'A'
    }
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: kvAccessObjectId
        permissions: {
          keys: [ 'all' ]
          secrets: [ 'all' ]
        }
      }
    ]
  }
}

resource openaiServiceKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (useExistingAOAIService) {
  parent: kv
  name: 'AZURE-OPENAI-SERVICE-KEY'
  properties: {
    value: openaiServiceKey
  }
}

output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
