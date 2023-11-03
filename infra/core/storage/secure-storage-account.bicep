param name string
param location string
param tags object = {}
param subnetResourceId string
param dnsZoneNameBlob string
param dnsZoneNameFile string
param dnsZoneNameQueue string
param dnsZoneNameTable string
param kind string = 'StorageV2'
param sku object = { name: 'Standard_LRS' }

resource storage 'Microsoft.Storage/storageAccounts@2022-05-01' = {
  name: name
  location: location
  tags: tags
  kind: kind
  sku: sku
  properties: {
    publicNetworkAccess: 'Disabled'
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    serviceName: name
    location: location
    tags: tags
    serviceResourceId: storage.id
    subnetResourceId: subnetResourceId
    groupId: 'Blob'
  }
}

module blobSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-blob-self'
  params: {
    hostname: name
    privateDnsZoneName: dnsZoneNameBlob
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

module fileSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-file-self'
  params: {
    hostname: name
    privateDnsZoneName: dnsZoneNameFile
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

module queueSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-queue-self'
  params: {
    hostname: name
    privateDnsZoneName: dnsZoneNameQueue
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

module tableSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-table-self'
  params: {
    hostname: name
    privateDnsZoneName: dnsZoneNameTable
    ipAddress: privateEndpoint.outputs.ipAddress
  }
}

output id string = storage.id
output privateEndpointId string = privateEndpoint.outputs.id
output privateEndpointName string = privateEndpoint.outputs.name
output privateEndpointIp string = privateEndpoint.outputs.ipAddress
