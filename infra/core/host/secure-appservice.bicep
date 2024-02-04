param name string
param location string
param tags object = {}
param dnsZoneName string
param subnetResourceIdOutbound string
param subnetResourceIdInbound string
param appServicePlanId string
param frontDoorSkuName string = 'Standard_AzureFrontDoor'
@description('The name of the Front Door endpoint to create. This must be globally unique.')
param frontDoorEndpointName string
param aadClientId string = ''
param tenantId string = subscription().tenantId

var frontDoorProfileName = 'InfoAsstFrontDoor'
var frontDoorOriginGroupName = 'InfoAsstOriginGroup'
var frontDoorOriginName = 'InfoAsstAppServiceOrigin'
var frontDoorRouteName = 'InfoAsstRoute'

resource frontDoorProfile 'Microsoft.Cdn/profiles@2021-06-01' = {
  name: frontDoorProfileName
  location: 'global'
  sku: {
    name: frontDoorSkuName
  }
}

resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: name
  location: location
  properties: {
    serverFarmId: appServicePlanId
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: subnetResourceIdOutbound
    siteConfig: {
      detailedErrorLoggingEnabled: true
      httpLoggingEnabled: true
      requestTracingEnabled: true
      ftpsState: 'Disabled'
      ipSecurityRestrictions: [
        {
          tag: 'ServiceTag'
          ipAddress: 'AzureFrontDoor.Backend'
          action: 'Allow'
          priority: 100
          headers: {
            'x-azure-fdid': [
              frontDoorProfile.properties.frontDoorId
            ]
          }
          name: 'Allow traffic from Front Door'
        }
      ]
    }
  }

  resource authSettingsV2 'config' = {
    name: 'authsettingsV2'
    properties: {
      globalValidation: {
        unauthenticatedClientAction: 'RedirectToLoginPage'
        redirectToProvider: 'AzureActiveDirectory'
        requireAuthentication: true
      }
      httpSettings: {
        requireHttps: true
        forwardProxy: {
          convention: 'Standard'
        }
      }
      identityProviders: {
        azureActiveDirectory: {
          enabled: true
          registration: {
            openIdIssuer: 'https://sts.windows.net/${tenantId}/v2.0'
            clientId: aadClientId
          }
          validation: {
            allowedAudiences: [
              'api://${name}', 'https://make ${frontDoorEndpoint.properties.hostName}'
            ]
            defaultAuthorizationPolicy: {
              allowedApplications: []
            }
          }
        }
      }
    }
  }
}

resource frontDoorEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2021-06-01' = {
  name: frontDoorEndpointName
  parent: frontDoorProfile
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

resource frontDoorOriginGroup 'Microsoft.Cdn/profiles/originGroups@2021-06-01' = {
  name: frontDoorOriginGroupName
  parent: frontDoorProfile
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Http'
      probeIntervalInSeconds: 100
    }
  }
}

resource frontDoorOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2021-06-01' = {
  name: frontDoorOriginName
  parent: frontDoorOriginGroup
  properties: {
    hostName: appService.properties.defaultHostName
    httpPort: 80
    httpsPort: 443
    originHostHeader: appService.properties.defaultHostName
    priority: 1
    weight: 1000
  }
}

resource frontDoorRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2021-06-01' = {
  name: frontDoorRouteName
  parent: frontDoorEndpoint
  dependsOn: [
    frontDoorOrigin // This explicit dependency is required to ensure that the origin group is not empty when the route is created.
  ]
  properties: {
    originGroup: {
      id: frontDoorOriginGroup.id
    }
    supportedProtocols: [
      'Http'
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: name
    location: location
    tags: tags
    serviceResourceId: appService.id
    subnetResourceId: subnetResourceIdInbound
    groupId: 'sites'
  }
}

module self '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${appService.name}-self'
  params: {
    hostname: appService.name
    groupId: privateEndpoint.outputs.groupId
    privateEndpointName: privateEndpoint.outputs.name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
  dependsOn: [
    privateEndpoint
  ]
}

module scm '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${appService.name}-scm'
  params: {
    hostname: '${appService.name}.scm'
    groupId: privateEndpoint.outputs.groupId
    privateEndpointName: privateEndpoint.outputs.name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
  dependsOn: [
    privateEndpoint
  ]
}

resource virtualNetworkConnection 'Microsoft.Web/sites/virtualNetworkConnections@2022-09-01' = {
  parent: appService
  name: 'virtual-network-connection'
  properties: {
    vnetResourceId: subnetResourceIdOutbound
    isSwift: true
  }
}

output ipAddress string = privateEndpoint.outputs.ipAddress
output name string = appService.name
output id string = appService.id
output uri string = 'https://${appService.properties.defaultHostName}'
output fqdn string = appService.properties.defaultHostName
