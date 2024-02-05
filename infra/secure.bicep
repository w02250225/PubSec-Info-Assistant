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

param buildNumber string = 'local'
param useExistingAOAIService bool
param openAiServiceName string = ''
param cognitiveServiesForSearchName string = ''
param cosmosdbName string = ''
param formRecognizerName string = ''
param enrichmentName string = ''
param appServicePlanName string = ''
param enrichmentAppServicePlanName string = ''
param resourceGroupName string = ''
param logAnalyticsName string = ''
param applicationInsightsName string = ''
param backendServiceName string = ''
param enrichmentServiceName string = ''
param functionsAppName string = ''
param mediaServiceName string = ''
param searchServicesName string = ''
param storageAccountName string = ''
param aadWebClientId string = ''

// SECURE ENVIRONMENT PARAMETERS
param networkSecurityGroupName string = ''
param vnetName string = ''
param frontDoorName string = ''
param privateLinkScopeName string = ''

@description('The IP address range of the virtual network in CIDR notation. Requires a minimum of /21. Example: 10.0.0.0/21')
param vnetIpAddressCIDR string = '10.0.0.0/21'
param snetPublicAccessCIDR string = '10.0.0.0/26'
param snetAzureMonitorCIDR string = '10.0.0.64/26'
param snetApiManagementCIDR string = '10.0.0.128/26'
param snetStorageAccountCIDR string = '10.0.1.0/26'
param snetCosmosDbCIDR string = '10.0.1.64/26'
param snetAzureAiCIDR string = '10.0.1.128/26'
param snetKeyVaultCIDR string = '10.0.1.192/26'
param snetAppInboundCIDR string = '10.0.2.0/26'
param snetAppOutboundCIDR string = '10.0.2.128/26'
param snetFunctionInboundCIDR string = '10.0.3.0/26'
param snetFunctionOutboundCIDR string = '10.0.3.128/26'
param snetEnrichmentInboundCIDR string = '10.0.4.0/26'
param snetEnrichmentOutboundCIDR string = '10.0.4.128/26'

//temp add to reuse param file
param aadMgmtClientId string = ''
@secure()
param aadMgmtClientSecret string = ''
param aadMgmtServicePrincipalId string = ''
param isInAutomation bool = false
param azureOpenAIServiceName string
param azureOpenAIResourceGroup string
@secure()
param azureOpenAIServiceKey string
param openAiSkuName string = 'S0'
param formRecognizerSkuName string = 'S0'
param enrichmentSkuName string = 'S0'
param videoIndexerName string = ''
param searchServicesSkuName string = 'standard'
param containerName string = 'content'
param uploadContainerName string = 'upload'
param functionLogsContainerName string = 'logs'
param searchIndexName string = 'vector-index'
param chatGptDeploymentName string = 'gpt-35-turbo-16k'
param azureOpenAIEmbeddingDeploymentName string = 'text-embedding-ada-002'
param azureOpenAIEmbeddingsModelName string = 'text-embedding-ada-002'
param azureOpenAIEmbeddingsModelVersion string = '2'
param useAzureOpenAIEmbeddings bool = true
param sentenceTransformersModelName string = 'BAAI/bge-small-en-v1.5'
param sentenceTransformerEmbeddingVectorSize string = '384'
param embeddingsDeploymentCapacity int = 240
param chatWarningBannerText string = ''
param chatGptModelName string = 'gpt-35-turbo-16k'
param chatGptModelVersion string = '0613'
param chatGptDeploymentCapacity int = 240
// metadata in our chunking strategy adds about 180-200 tokens to the size of the chunks, 
// our default target size is 750 tokens so the chunk files that get indexed will be around 950 tokens each
param chunkTargetSize string = '750'
param targetPages string = 'ALL'
param formRecognizerApiVersion string = '2022-08-31'
param queryTermLanguage string = 'English'
param cuaEnabled bool = false
param cuaId string = ''
param enableDevCode bool = false
param tenantId string = ''
param subscriptionId string = ''

@description('Id of the user or app to assign application roles')
param principalId string = ''
param kvAccessObjectId string = ''
// This block of variables are used for Branding
param applicationtitle string = ''
param targetTranslationLanguage string = 'en'
// end of temp section

var tags = { ProjectName: 'Information Assistant', BuildNumber: buildNumber }
var prefix = 'infoasst'

// SECURE ENVIRONMENT VARIABLES
var abbrs = loadJsonContent('abbreviations.json')
var azureRoles = loadJsonContent('azure_roles.json')

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
    tags: tags
    vnetIpAddressCIDR: vnetIpAddressCIDR
    snetPublicAccessCIDR: snetPublicAccessCIDR
    snetAzureMonitorCIDR: snetAzureMonitorCIDR
    snetApiManagementCIDR: snetApiManagementCIDR
    snetStorageAccountCIDR: snetStorageAccountCIDR
    snetCosmosDbCIDR: snetCosmosDbCIDR
    snetAzureAiCIDR: snetAzureAiCIDR
    snetKeyVaultCIDR: snetKeyVaultCIDR
    snetAppInboundCIDR: snetAppInboundCIDR
    snetAppOutboundCIDR: snetAppOutboundCIDR
    snetFunctionInboundCIDR: snetFunctionInboundCIDR
    snetFunctionOutboundCIDR: snetFunctionOutboundCIDR
    snetEnrichmentInboundCIDR: snetEnrichmentInboundCIDR
    snetEnrichmentOutboundCIDR: snetEnrichmentOutboundCIDR
  }
  dependsOn: [
    networkSecurityGroup
  ]
}

module privateDnsZoneAzureOpenAi 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-azure-openai'
  params: {
    name: contains(location, 'USGov') ? 'openai.azure.com' : 'privatelink.openai.azure.com'
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
    name: contains(location, 'USGov') ? 'usgovcloudapi.net' : 'privatelink.azure-api.net'
    vnetLinkName: '${prefix}-link-api-management-${randomString}'
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
    name: contains(location, 'USGov') ? 'cognitiveservices.azure.us' : 'privatelink.cognitiveservices.azure.com'
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
    name: contains(location, 'USGov') ? 'azurewebsites.us' : 'privatelink.azurewebsites.net'
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
    name: 'privatelink${environment().suffixes.keyvaultDns}'
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
    name: 'privatelink.blob.${environment().suffixes.storage}'
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
    name: 'privatelink.file.${environment().suffixes.storage}'
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
    name: 'privatelink.table.${environment().suffixes.storage}'
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
    name: 'privatelink.queue.${environment().suffixes.storage}'
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
    name: contains(location, 'USGov') ? 'search.windows.us' : 'privatelink.search.windows.net'
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
    name: contains(location, 'USGov') ? 'documents.azure.us' : 'privatelink.documents.azure.com'
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
    name: 'privatelink.media.azure.net'
    vnetLinkName: '${prefix}-link-media-service-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}


module privateDnsZoneAzureMonitor 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-azure-monitor'
  params: {
    name: contains(location, 'USGov') ? 'privatelink.monitor.azure.us' : 'privatelink.monitor.azure.com'
    vnetLinkName: '${prefix}-link-azure-monitor-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneOpsInsightOms 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-ops-insight-oms'
  params: {
    name: contains(location, 'USGov') ? 'privatelink.oms.opinsights.azure.us' : 'privatelink.oms.opinsights.azure.com'
    vnetLinkName: '${prefix}-link-ops-insight-oms-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}
module privateDnsZoneOpsInsightOds 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-ops-insight-ods'
  params: {
    name: contains(location, 'USGov') ? 'privatelink.ods.opinsights.azure.us' : 'privatelink.ods.opinsights.azure.com'
    vnetLinkName: '${prefix}-link-ops-insight-ods-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}

module privateDnsZoneAutomation 'core/dns/secure-private_dns_zone.bicep' = {
  scope: rg
  name: 'secure-private-dns-zone-automation'
  params: {
    name: contains(location, 'USGov') ? 'privatelink.agentsvc.azure-automation.us' : 'privatelink.agentsvc.azure-automation.net'
    vnetLinkName: '${prefix}-link-ops-automation-${randomString}'
    location: 'global'
    tags: tags
    vnetResourceId: network.outputs.id
  }
  dependsOn: [
    network
  ]
}


module privateLinkScope 'core/network/secure-private_link_scope.bicep' = {
  scope: rg
  name: 'private-link-scope'
  params: {
    name: !empty(privateLinkScopeName) ? privateLinkScopeName : '${prefix}-apls-${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureMonitor
    workspaceName: !empty(logAnalyticsName) ? logAnalyticsName : '${prefix}-${abbrs.logAnalytics}${randomString}'
    appInsightsName: !empty(applicationInsightsName) ? applicationInsightsName : '${prefix}-${abbrs.appInsights}${randomString}'
    privateDnsZoneResourceIdMonitor: privateDnsZoneAzureMonitor.outputs.id
    privateDnsZoneResourceIdOpsInsightOms: privateDnsZoneOpsInsightOms.outputs.id
    privateDnsZoneResourceIdOpsInsightOds: privateDnsZoneOpsInsightOds.outputs.id
    privateDnsZoneResourceIdAutomation: privateDnsZoneAutomation.outputs.id
    privateDnsZoneResourceIdBlob: privateDnsZoneStorageAccountBlob.outputs.id
    groupId: 'azuremonitor'
  }
  dependsOn: [
    privateDnsZoneAzureMonitor
    privateDnsZoneOpsInsightOms
    privateDnsZoneOpsInsightOds
    privateDnsZoneAutomation
    privateDnsZoneStorageAccountBlob
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
    frontDoorEndpointName: !empty(frontDoorName) ? frontDoorName : '${prefix}-${abbrs.frontDoor}${randomString}'
    frontDoorSkuName: 'Premium_AzureFrontDoor'
    aadClientId: aadWebClientId
  }
  dependsOn: [
    appServicePlan
  ]
}

module enrichmentAppServicePlan 'core/host/secure-enrichmentappserviceplan.bicep' = {
  name: 'secure-enrichment-app-service-plan'
  scope: rg
  params: {
    name: !empty(enrichmentAppServicePlanName) ? enrichmentAppServicePlanName : '${prefix}-enrichment${abbrs.webServerFarms}${randomString}'
    location: location
    tags: tags
    sku: {
      name: 'P1v3'
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
    subnetResourceIdInbound: network.outputs.subnetIdEnrichmentInbound
    subnetResourceIdOutbound: network.outputs.subnetIdEnrichmentOutbound
  }
  dependsOn: [
    enrichmentAppServicePlan
  ]
}

module funcServicePlan 'core/host/funcserviceplan.bicep' = {
  name: 'secure-funcserviceplan'
  scope: rg
  params: {
    name: !empty(appServicePlanName) ? appServicePlanName : '${prefix}-${abbrs.funcServerFarms}${randomString}'
    location: location
    tags: tags
    sku: {
      name: 'S2'
      capacity: 2
    }
    kind: 'linux'
  }
}

module cognitiveServices 'core/ai/secure-cognitiveservices.bicep' = if (!useExistingAOAIService) {
  scope: rg
  name: 'secure-azure-openai'
  params: {
    name: !empty(openAiServiceName) ? openAiServiceName : '${prefix}-${abbrs.openAIServices}${randomString}'
    location: location
    tags: tags
    subnetResourceId: network.outputs.subnetIdAzureAi
    dnsZoneName: privateDnsZoneAzureOpenAi.outputs.name
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
    subnetResourceIdOutbound: network.outputs.subnetIdFunctionOutbound
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

module storageRoleFunc 'core/security/role.bicep' = {
  scope: rg
  name: 'storage-role-Func'
  params: {
    principalId: functions.outputs.identityPrincipalId
    roleDefinitionId: azureRoles.StorageBlobDataReader
    principalType: 'ServicePrincipal'
  }
}
