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

module privateEndpointBlob '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: '${name}-blob'
    location: location
    tags: tags
    serviceResourceId: storage.id
    subnetResourceId: subnetResourceId
    groupId: 'Blob'
  }
}

module privateEndpointFile '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: '${name}-file'
    location: location
    tags: tags
    serviceResourceId: storage.id
    subnetResourceId: subnetResourceId
    groupId: 'File'
  }
}

module privateEndpointQueue '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: '${name}-queue'
    location: location
    tags: tags
    serviceResourceId: storage.id
    subnetResourceId: subnetResourceId
    groupId: 'Queue'
  }
}

module privateEndpointTable '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: '${name}-table'
    location: location
    tags: tags
    serviceResourceId: storage.id
    subnetResourceId: subnetResourceId
    groupId: 'Table'
  }
}

module blobSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-blob-self'
  params: {
    hostname: name
    groupId: 'Blob'
    privateEndpointName: privateEndpointBlob.outputs.name
    privateDnsZoneName: dnsZoneNameBlob
    ipAddress: privateEndpointBlob.outputs.ipAddress
  }
}

module fileSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-file-self'
  params: {
    hostname: name
    groupId: 'File'
    privateEndpointName: privateEndpointFile.outputs.name
    privateDnsZoneName: dnsZoneNameFile
    ipAddress: privateEndpointFile.outputs.ipAddress
  }
}

module queueSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-queue-self'
  params: {
    hostname: name
    groupId: 'Queue'
    privateEndpointName: privateEndpointQueue.outputs.name
    privateDnsZoneName: dnsZoneNameQueue
    ipAddress: privateEndpointQueue.outputs.ipAddress
  }
}

module tableSelf '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${name}-table-self'
  params: {
    hostname: name
    groupId: 'Table'
    privateEndpointName: privateEndpointTable.outputs.name
    privateDnsZoneName: dnsZoneNameTable
    ipAddress: privateEndpointTable.outputs.ipAddress
  }
}

output id string = storage.id
output privateEndpointIdBlob string = privateEndpointBlob.outputs.id
output privateEndpointNameBlob string = privateEndpointBlob.outputs.name
output privateEndpointIpBlob string = privateEndpointBlob.outputs.ipAddress
output privateEndpointIdFile string = privateEndpointFile.outputs.id
output privateEndpointNameFile string = privateEndpointFile.outputs.name
output privateEndpointIpFile string = privateEndpointFile.outputs.ipAddress
output privateEndpointIdQueue string = privateEndpointQueue.outputs.id
output privateEndpointNameQueue string = privateEndpointQueue.outputs.name
output privateEndpointIpQueue string = privateEndpointQueue.outputs.ipAddress
output privateEndpointIdTable string = privateEndpointTable.outputs.id
output privateEndpointNameTable string = privateEndpointTable.outputs.name
output privateEndpointIpTable string = privateEndpointTable.outputs.ipAddress
