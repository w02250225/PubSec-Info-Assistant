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
param wafMode string = 'Prevention'

var frontDoorProfileName = 'InfoAsstFrontDoor'
var frontDoorOriginGroupName = 'InfoAsstOriginGroup'
var frontDoorOriginName = 'InfoAsstAppServiceOrigin'
var frontDoorRouteName = 'InfoAsstRoute'
var securityPolicyName = 'wafSecurityPolicy'
var wafPolicyName = 'wafPolicy'

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
    publicNetworkAccess: 'Disabled'
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

  resource basicPublishingProfileFtp 'basicPublishingCredentialsPolicies' = {
    name: 'ftp'
    properties: {
      allow: false
    }
  }

  resource basicPublishingProfileScm 'basicPublishingCredentialsPolicies' = {
    name: 'scm'
    properties: {
      allow: false
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
              'api://${name}', 'https://${frontDoorEndpoint.properties.hostName}'
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
    sharedPrivateLinkResource: {
      groupId: 'sites'
      privateLink: {
        id: appService.id
      }
      privateLinkLocation: location
      requestMessage: 'Private Link from AFD'
    }
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

// WAF Policy with DRS 2.1 and Bot Manager 1.0
resource wafPolicy 'Microsoft.Network/frontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: wafPolicyName
  location: 'Global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: wafMode
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleSetAction: 'Block'
        }
      ]
    }
  }
}

// Attach WAF Policy to endpoint
resource cdn_waf_security_policy 'Microsoft.Cdn/profiles/securitypolicies@2021-06-01' = {
  parent: frontDoorProfile
  name: securityPolicyName
  properties: {
    parameters: {
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
            id: frontDoorEndpoint.id
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

resource virtualNetworkConnection 'Microsoft.Web/sites/virtualNetworkConnections@2022-09-01' = {
  parent: appService
  name: 'virtual-network-connection'
  properties: {
    vnetResourceId: subnetResourceIdOutbound
    isSwift: true
  }
}

output name string = appService.name
output id string = appService.id
output uri string = 'https://${appService.properties.defaultHostName}'
output frontDoorEndpointName string = frontDoorEndpoint.properties.hostName
