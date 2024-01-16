param name string
param location string = resourceGroup().location
param tags object = {}
param sku string = ''
param isGovCloudDeployment bool  
param keyVaultName string = ''

resource cognitiveService 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = if (!isGovCloudDeployment) {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  kind: 'CognitiveServices'
  properties: {
    apiProperties: {
      statisticsEnabled: false
    }
  }
}

//Additional resouce to handle the api version parody issue.  
resource cognitiveServiceGov 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = if (isGovCloudDeployment) {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  kind: 'CognitiveServices'
  properties: {
    apiProperties: {
      statisticsEnabled: false
    }
    networkAcls: {
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = if (!(empty(keyVaultName))) {
  name: keyVaultName
}

resource enrichmentKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ENRICHMENT-KEY'
  properties: {
    value: (isGovCloudDeployment) ? cognitiveServiceGov.listKeys().key1 : cognitiveService.listKeys().key1
  }
}

output cognitiveServicerAccountName string = (isGovCloudDeployment) ? cognitiveServiceGov.name : cognitiveService.name
output cognitiveServiceID string = (isGovCloudDeployment) ? cognitiveServiceGov.id : cognitiveService.id
output cognitiveServiceEndpoint string = (isGovCloudDeployment) ? cognitiveServiceGov.properties.endpoint : cognitiveService.properties.endpoint
