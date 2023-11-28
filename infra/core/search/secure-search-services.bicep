param nameSearch string
param nameAccount string
param location string
param tags object = {}
param subnetResourceIdSearch string
param subnetResourceIdAccount string
param dnsZoneNameSearch string
param dnsZoneNameAccount string
param kind string = 'CognitiveServices'
param sku object = {
  name: 'standard'
}
param cogServicesSku object = {
  name: 'S0'
}

resource search 'Microsoft.Search/searchServices@2021-04-01-preview' = {
  name: nameSearch
  location: location
  sku: sku
  tags: tags
  properties: {
    publicNetworkAccess: 'Disabled'
  }
}

resource account 'Microsoft.CognitiveServices/accounts@2022-10-01' = {
  name: nameAccount
  location: location
  tags: tags
  kind: kind
  sku: cogServicesSku
  properties: {
    customSubDomainName: nameAccount
    publicNetworkAccess: 'Disabled'
  }
}


module privateEndpointSearch '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${nameSearch}'
  params: {
    serviceName: nameSearch
    location: location
    tags: tags
    serviceResourceId: search.id
    subnetResourceId: subnetResourceIdSearch
    groupId: 'searchService'
  }
}

module selfSearch '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${nameSearch}-self'
  params: {
    hostname: nameSearch
    groupId: privateEndpointSearch.outputs.groupId
    privateEndpointName: privateEndpointSearch.outputs.name
    privateDnsZoneName: dnsZoneNameSearch
    ipAddress: privateEndpointSearch.outputs.ipAddress
  }
}

module privateEndpointAccount '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${nameAccount}'
  params: {
    serviceName: nameAccount
    location: location
    tags: tags
    serviceResourceId: account.id
    subnetResourceId: subnetResourceIdAccount
    groupId: 'account'
  }
}

module selfAccount '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${nameAccount}-self'
  params: {
    hostname: nameAccount
    groupId: privateEndpointAccount.outputs.groupId
    privateEndpointName: privateEndpointAccount.outputs.name
    privateDnsZoneName: dnsZoneNameAccount
    ipAddress: privateEndpointAccount.outputs.ipAddress
  }
}

output privateEndpointIdSearch string = privateEndpointSearch.outputs.id
output privateEndpointNameSearch string = privateEndpointSearch.outputs.name
output privateEndpointIpSearch string = privateEndpointSearch.outputs.ipAddress
output privateEndpointIdAccount string = privateEndpointAccount.outputs.id
output privateEndpointNameAccount string = privateEndpointAccount.outputs.name
output privateEndpointIpAccount string = privateEndpointAccount.outputs.ipAddress
