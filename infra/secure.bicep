targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@maxLength(5)
param randomString string

@minLength(1)
@description('Primary location for all resources')
param location string

param aadWebClientId string = ''
param aadMgmtClientId string = ''
@secure()
param aadMgmtClientSecret string = ''
param aadMgmtServicePrincipalId string = ''
param buildNumber string = 'local'
param isInAutomation bool = false
param useExistingAOAIService bool
param azureOpenAIServiceName string = ''
param azureOpenAIResourceGroup string = ''
param azureOpenAIServiceKey string = ''
param openAiServiceName string = ''
param openAiSkuName string = 'S0'
param cognitiveServiesForSearchName string = ''
param cosmosdbName string = ''
param formRecognizerName string = ''
param enrichmentName string = ''
param formRecognizerSkuName string = 'S0'
param encichmentSkuName string = 'S0'
param cognitiveServiesForSearchSku string = 'S0'
param appServicePlanName string = ''
param enrichmentAppServicePlanName string = ''
param resourceGroupName string = ''
param logAnalyticsName string = ''
param applicationInsightsName string = ''
param backendServiceName string = ''
param enrichmentServiceName string = ''
param functionsAppName string = ''
param mediaServiceName string = ''
param videoIndexerName string = ''
param searchServicesName string = ''
param searchServicesSkuName string = 'standard'
param storageAccountName string = ''
param containerName string = 'content'
param uploadContainerName string = 'upload'
param functionLogsContainerName string = 'logs'
param searchIndexName string = 'all-files-index'
param chatGptDeploymentName string = 'chat'
param chatGptModelName string = 'gpt-35-turbo-16k'
param chatGptModelVersion string = '0613'
param chatGptDeploymentCapacity int = 1
// metadata in our chunking strategy adds about 180-200 tokens to the size of the chunks, 
// our default target size is 750 tokens so the chunk files that get indexed will be around 950 tokens each
param chunkTargetSize string = '750' 
param targetPages string = 'ALL'
param formRecognizerApiVersion string = '2022-08-31'
param pdfSubmitQueue string = 'pdf-submit-queue'
param pdfPollingQueue string = 'pdf-polling-queue'
param nonPdfSubmitQueue string = 'non-pdf-submit-queue'
param mediaSubmitQueue string = 'media-submit-queue'
param textEnrichmentQueue string = 'text-enrichment-queue'
param queryTermLanguage string = 'English'
param maxSecondsHideOnUpload string = '300'
param maxSubmitRequeueCount string = '10'
param pollQueueSubmitBackoff string = '60'
param pdfSubmitQueueBackoff string = '60'
param maxPollingRequeueCount string = '10'
param submitRequeueHideSeconds  string = '1200'
param pollingBackoff string = '30'
param maxReadAttempts string = '5'
param cuaEnabled bool = false
param cuaId string = ''
param maxEnrichmentRequeueCount string = '10'
param enrichmentBackoff string = '60'
param targetTranslationLanguage string = 'en'
param enableDevCode bool = false
param tenantId string = ''
param subscriptionId string = ''

@description('Id of the user or app to assign application roles')
param principalId string = ''

// SECURE ENVIRONMENT PARAMETERS
param networkSecurityGroupName string = ''
param vnetName string = ''
param frontDoorName string = ''
param frontDoorWafPolicyName string = ''

var abbrs = loadJsonContent('abbreviations.json')
var tags = { ProjectName: 'Information Assistant', BuildNumber: buildNumber }
var prefix = 'infoasst'



// Organize resources in a resource group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${prefix}-${environmentName}'
  location: location
  tags: tags
}

module networkSecurityGroup 'core/network/secure-network_security_group.bicep' = {
  scope: rg
  name: 'secure-network-security-group'
  params: {
    location: location
    tags: tags
    nsgName: !empty(networkSecurityGroupName) ? networkSecurityGroupName : '${prefix}-${abbrs.appInsights}${randomString}'
  }
}

module network 'core/network/secure-network.bicep' = {
  scope: rg
  name: 'secure-network'
  params: {
    vnetName: !empty(vnetName) ? vnetName : '${prefix}-${abbrs.networkVirtualNetworks}${randomString}'
    location: location
    networkSecurityGroupId: networkSecurityGroup.outputs.id
  }
  dependsOn: [
    networkSecurityGroup
  ]
}

module privateDnsZoneAzureOpenAi 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-azure-openai'
  params: {
    name: contains(location, 'USGov') ? 'openai.azure.com' : 'openai.azure.com'
    vnetLinkName: '${prefix}-link-azure-openai-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneApiManagement 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-api-management'
  params: {
    name: contains(location, 'USGov') ? 'usgovcloudapi.net' : 'azure-api.net'
    vnetLinkName: '${prefix}-link-api-management-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneAppService 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-app-service'
  params: {
    name: contains(location, 'USGov') ? 'appserviceenvironment.us' : 'appserviceenvironment.net'
    vnetLinkName: '${prefix}-link-app-service-outbound-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneAzureAi 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-azure-ai'
  params: {
    name: contains(location, 'USGov') ? 'cognitiveservices.azure.us' : 'cognitiveservices.azure.com'
    vnetLinkName: '${prefix}-link-azure-ai-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneApp 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-app'
  params: {
    name: contains(location, 'USGov') ? 'azurewebsites.us' : 'azurewebsites.net'
    vnetLinkName: '${prefix}-link-app-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneKeyVault 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-key-vault'
  params: {
    name: contains(location, 'USGov') ? 'vault.usgovcloudapi.net' : 'vault.azure.net'
    vnetLinkName: '${prefix}-link-key-vault-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneStorageAccountBlob 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-storage-account-blob'
  params: {
    name: contains(location, 'USGov') ? 'blob.core.usgovcloudapi.net' : 'blob.core.windows.net'
    vnetLinkName: '${prefix}-link-storate-account-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneStorageAccountFile 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-storage-account-file'
  params: {
    name: contains(location, 'USGov') ? 'file.core.usgovcloudapi.net' : 'file.core.windows.net'
    vnetLinkName: '${prefix}-link-storate-account-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneStorageAccountTable 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-storage-account-table'
  params: {
    name: contains(location, 'USGov') ? 'table.core.usgovcloudapi.net' : 'table.core.windows.net'
    vnetLinkName: '${prefix}-link-storate-account-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneStorageAccountQueue 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-storage-account-queue'
  params: {
    name: contains(location, 'USGov') ? 'queue.core.usgovcloudapi.net' : 'queue.core.windows.net'
    vnetLinkName: '${prefix}-link-storate-account-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneSearchService 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-search-service'
  params: {
    name: contains(location, 'USGov') ? 'search.windows.us' : 'search.windows.net'
    vnetLinkName: '${prefix}-link-service-service-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneCosmosDb 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-cosmos-db'
  params: {
    name: contains(location, 'USGov') ? 'documents.azure.us' : 'documents.azure.com'
    vnetLinkName: '${prefix}-link-cosmos-db-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneMediaService 'core/dns/secure-private_dns_zone.bicep' = if (!contains(location, 'USGov')) {
  scope: rg
  name: 'secure-private-dns-zone-media-service'
  params: {
    name: 'media.azure.net'
    vnetLinkName: '${prefix}-link-media-service-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module appServicePlan 'core/host/appserviceplan.bicep' = {
  name: 'secure-app-service-plan'
  scope: rg
  params: {
    name: !empty(appServicePlanName) ? appServicePlanName : '${prefix}-${abbrs.webServerFarms}${randomString}'
    location: location
    tags: tags
    sku: {
      name: 'P2v3'
      capacity: 1
    }
    kind: 'linux'
  }
}

module backend 'core/host/secure-appservice.bicep' = {
  name: 'secure-web'
  scope: rg
  params: {
    name: !empty(backendServiceName) ? backendServiceName : '${prefix}-${abbrs.webSitesAppService}${randomString}'
    location: location
    tags: tags
    appServicePlanId: appServicePlan.outputs.id
    dnsZoneName: privateDnsZoneApp.outputs.name
    subnetResourceIdInbound: network.outputs.subnetIdAppInbound
    subnetResourceIdOutbound: network.outputs.subnetIdAppOutbound
  }
  dependsOn: [
    appServicePlan
  ]
}

module enrichmentAppServicePlan 'core/host/appserviceplan.bicep' = {
  name: 'secure-enrichment-app-service-plan'
  scope: rg
  params: {
    name: !empty(enrichmentAppServicePlanName) ? enrichmentAppServicePlanName : '${prefix}-enrichment${abbrs.webServerFarms}${randomString}'
    location: location
    tags: tags
    sku: {
      name: 'P2v3'
      capacity: 1
    }
    kind: 'linux'
  }
}

module enrichmentApp 'core/host/secure-enrichmentappservice.bicep' = {
  name: 'secure-enrichment-app'
  scope: rg
  params: {
    name: !empty(enrichmentServiceName) ? enrichmentServiceName : '${prefix}-enrichment${abbrs.webSitesAppService}${randomString}'
    location: location
    tags: tags
    appServicePlanId: enrichmentAppServicePlan.outputs.id
    dnsZoneName: privateDnsZoneApp.outputs.name
    subnetResourceIdInbound: network.outputs.subnetIdAppInbound
    subnetResourceIdOutbound: network.outputs.subnetIdAppOutbound
  }
  dependsOn: [
    enrichmentAppServicePlan
  ]
}

module cognitiveServices 'core/ai/secure-cognitiveservices.bicep' = if (!useExistingAOAIService) {
  scope: rg
  name: 'secure-azure-openai'
  params: {
    name: !empty(openAiServiceName) ? openAiServiceName : '${prefix}-${abbrs.openAIServices}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureAi
    dnsZoneName: privateDnsZoneAzureAi.outputs.name
  }
}

module formrecognizer 'core/ai/secure-formrecognizer.bicep' = {
  scope: rg
  name: 'secure-form-recognizer'
  params: {
    name: !empty(formRecognizerName) ? formRecognizerName : '${prefix}-${abbrs.formRecognizer}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureAi
    dnsZoneName: privateDnsZoneAzureAi.outputs.name
  }
}

module enrichment 'core/ai/secure-enrichment.bicep' = {
  scope: rg
  name: 'secure-enrichment'
  params: {
    name: !empty(enrichmentName) ? enrichmentName : '${prefix}-enrichment-${abbrs.cognitiveServicesAccounts}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureAi
    dnsZoneName: privateDnsZoneAzureAi.outputs.name
  }
}

module searchServices 'core/search/secure-search-services.bicep' = {
  scope: rg
  name: 'secure-search-services'
  params: {
    nameSearch: !empty(searchServicesName) ? searchServicesName : '${prefix}-${abbrs.searchSearchServices}${randomString}'
    nameAccount: !empty(cognitiveServiesForSearchName) ? cognitiveServiesForSearchName : '${prefix}-${abbrs.cognitiveServicesAccounts}${randomString}'
    location: location
    tags: tags
    subnetResourceIdSearch: network.outputs.subnetIdAzureAi
    subnetResourceIdAccount: network.outputs.subnetIdAzureAi
    dnsZoneNameSearch: privateDnsZoneSearchService.outputs.name
    dnsZoneNameAccount: privateDnsZoneAzureAi.outputs.name
  }
}

module storage 'core/storage/secure-storage-account.bicep' = {
  name: 'secure-storage'
  scope: rg
  params: {
    name: !empty(storageAccountName) ? storageAccountName : '${prefix}${abbrs.storageStorageAccounts}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdStorageAccount
    dnsZoneNameBlob: privateDnsZoneStorageAccountBlob.outputs.name
    dnsZoneNameFile: privateDnsZoneStorageAccountFile.outputs.name
    dnsZoneNameTable: privateDnsZoneStorageAccountTable.outputs.name
    dnsZoneNameQueue: privateDnsZoneStorageAccountQueue.outputs.name
  }
}

module storageMedia 'core/storage/secure-storage-account.bicep' = {
  name: 'secure-storage-media'
  scope: rg
  params: {
    name: !empty(storageAccountName) ? storageAccountName : '${prefix}${abbrs.storageStorageAccounts}media${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdStorageAccount
    dnsZoneNameBlob: privateDnsZoneStorageAccountBlob.outputs.name
    dnsZoneNameFile: privateDnsZoneStorageAccountFile.outputs.name
    dnsZoneNameTable: privateDnsZoneStorageAccountTable.outputs.name
    dnsZoneNameQueue: privateDnsZoneStorageAccountQueue.outputs.name
  }
}

module cosmosdb 'core/db/secure-cosmosdb.bicep' = {
  name: 'secure-cosmos-db'
  scope: rg
  params: {
    name: !empty(cosmosdbName) ? cosmosdbName : '${prefix}-${abbrs.cosmosDBAccounts}${randomString}'
    location: location
    tags: tags
    subnetResourceId:network.outputs.subnetIdCosmosDb
    dnsZoneName: privateDnsZoneCosmosDb.outputs.name
  }
}

// Function App 
module functions 'core/function/secure-function.bicep' = {
  name: 'secure-functions'
  scope: rg
  params: {
    name: !empty(functionsAppName) ? functionsAppName : '${prefix}-${abbrs.webSitesFunctions}${randomString}'
    location: location
    tags: tags
    appServicePlanId: appServicePlan.outputs.id
    dnsZoneName: privateDnsZoneApp.outputs.name
    subnetResourceIdInbound: network.outputs.subnetIdFunctionInbound
    subnetResourceIdOutbound: network.outputs.subnetIdAppOutbound
  }
}

module media_service 'core/video_indexer/secure-media_service.bicep' = if (!contains(location, 'USGov')) {
  name: 'secure-media-service'
  scope: rg
  params: {
    name: !empty(mediaServiceName) ? mediaServiceName : '${prefix}${abbrs.mediaService}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureAi
    dnsZoneName: privateDnsZoneMediaService.outputs.name
    storageAccountID: storageMedia.outputs.id
  }
}

module frontDoorWafPolicy 'core/network/secure-front_door-waf_policy.bicep' = {
  name: 'secure-front-door-waf-policy'
  scope: rg
  params: {
    name: !empty(frontDoorWafPolicyName) ? frontDoorWafPolicyName : '${prefix}waf${randomString}'
    location: location
    tags: tags
    sku: {
      name: 'Premium_AzureFrontDoor'
    }
    state: 'Enabled'
    mode: 'Detection'
  }
  dependsOn: [
    network
  ]
}


module frontDoor 'core/network/secure-front_door.bicep' = {
  name: 'secure-front-door'
  scope: rg
  params: {
    name: !empty(frontDoorName) ? frontDoorName : '${prefix}-${abbrs.networkFrontDoors}${randomString}'
    location: 'Global'
    locationRegion: location
    tags: tags
    prefix: prefix
    originFqdn: backend.outputs.fqdn
    wafPolicyResourceId: frontDoorWafPolicy.outputs.id
    backendResourceId: backend.outputs.id
  }
  dependsOn: [
    network
    frontDoorWafPolicy
  ]
}

output FRONTDOOR_URI string = frontDoor.outputs.uri
