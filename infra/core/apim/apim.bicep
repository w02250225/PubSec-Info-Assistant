

param name string
param location string = resourceGroup().location
param tags object = {}

param publisherEmail string
param publisherName string

param sku object = {
  name: 'Consumption'
  capacity: 0
}


resource apim 'Microsoft.ApiManagement/service@2022-08-01' = {
  name: name
  location: location
  tags: tags
  sku: sku
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
  }
}


resource oai_api 'Microsoft.ApiManagement/service/apis@2022-08-01' = {
  name: '${apim.name}oai'
  parent: apim
  properties: {
    displayName: 'test'
    apiRevision: '1'
    subscriptionRequired: true
    protocols: [
        'https'
    ]
    authenticationSettings: {
        oAuth2AuthenticationSettings: []
        openidAuthenticationSettings: []
    }
    subscriptionKeyParameterNames: {
        header: 'Ocp-Apim-Subscription-Key'
        query: 'subscription-key'
    }
    isCurrent: true
    path: '/test'
  }
}
