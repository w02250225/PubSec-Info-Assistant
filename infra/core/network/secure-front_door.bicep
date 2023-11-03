param name string
param location string
param locationRegion string
param tags object = {}
param sku string = 'Premium_AzureFrontDoor'
param identity string = 'SystemAssigned'
param prefix string
param originFqdn string
param backendResourceId string
param wafPolicyResourceId string

var random = substring((resourceGroup().id),0,5)

resource frontDoor 'Microsoft.Cdn/profiles@2022-11-01-preview' = {
  name: '${name}-${random}'
  location: location
  tags: tags
  sku: {
    name: sku
  }
  identity: {
    type: identity
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdendpoints@2022-11-01-preview' = {
  parent: frontDoor
  name: prefix
  location: location
  properties: {
    enabledState: 'Enabled'
  }
}

resource originGroup 'Microsoft.Cdn/profiles/origingroups@2022-11-01-preview' = {
  parent: frontDoor
  name: '${frontDoor.name}-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Http'
      probeIntervalInSeconds: 100
    }
    sessionAffinityState: 'Disabled'
  }
}

resource origin 'Microsoft.Cdn/profiles/origingroups/origins@2022-11-01-preview' = {
  parent: originGroup
  name: '${frontDoor.name}-origin'
  properties: {
    hostName: originFqdn
    httpPort: 80
    httpsPort: 443
    originHostHeader: originFqdn
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    sharedPrivateLinkResource: {
      privateLink: {
        id: backendResourceId
      }
      groupId: 'sites'
      privateLinkLocation: locationRegion
      requestMessage: 'add'
      status: 'Approved'
    }
    enforceCertificateNameCheck: true
  }
}

resource defaultRoute 'Microsoft.Cdn/profiles/afdendpoints/routes@2022-11-01-preview' = {
  parent: endpoint
  name: '${originGroup.name}-route'
  properties: {
    customDomains: []
    originGroup: {
      id: originGroup.id
    }
    ruleSets: []
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    origin
  ]
}

resource assignWafPolicy 'Microsoft.Cdn/profiles/securitypolicies@2022-11-01-preview' = {
  parent: frontDoor
  name: '${frontDoor.name}-assign-waf'
  properties: {
    parameters: {
      wafPolicy: {
        id: wafPolicyResourceId
      }
      associations: [
        {
          domains: [
            {
              id: endpoint.id
            }
          ]
          patternsToMatch: [
            '/*'
          ]
        }
      ]
      type: 'WebApplicationFirewall'
    }
  }
}

output id string = frontDoor.id
output name string = frontDoor.name
output fqdn string = endpoint.properties.hostName
output uri string = 'https://${endpoint.properties.hostName}'
