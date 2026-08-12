# Datadog — Getting Started with Datadog Sites (site parameters)

- Source URL: https://docs.datadoghq.com/getting_started/site.md
- Accessed: 2026-08-12 (native vendor markdown mirror served by docs.datadoghq.com, fetched verbatim with curl)

---
title: Getting Started with Datadog Sites
description: >-
  Learn about different Datadog sites for your region and security requirements,
  including government-compliant options.
breadcrumbs: Docs > Getting Started > Getting Started with Datadog Sites
---

> For the complete documentation index, see [llms.txt](https://docs.datadoghq.com/llms.txt).

# Getting Started with Datadog Sites

## Overview{% #overview %}

Datadog offers different sites throughout the world. Each site is completely independent, and you cannot share data across sites. Each site gives you benefits (for example, government security regulations) or allows you to store your data in specific locations around the world.

## Shared responsibility{% #shared-responsibility %}

The responsibility of keeping user data secure is shared between Datadog and developers who leverage Datadog products.

Datadog is responsible for:

- Providing a reliable product that handles data securely when it is transmitted to and stored on the Datadog platform.
- Ensuring that security issues are identified in accordance with internal policies.

Developers are responsible for:

- Leveraging configuration values and data privacy options as provided by Datadog.
- Ensuring the integrity of code within their environments.

## Access the Datadog site{% #access-the-datadog-site %}

| Site    | Site URL                    | Site Parameter      | Location     |
| ------- | --------------------------- | ------------------- | ------------ |
| US1     | `https://app.datadoghq.com` | `datadoghq.com`     | US           |
| US3     | `https://us3.datadoghq.com` | `us3.datadoghq.com` | US           |
| US5     | `https://us5.datadoghq.com` | `us5.datadoghq.com` | US           |
| EU1     | `https://app.datadoghq.eu`  | `datadoghq.eu`      | EU (Germany) |
| US1-FED | `https://app.ddog-gov.com`  | `ddog-gov.com`      | US           |
| US2-FED | `https://us2.ddog-gov.com`  | `us2.ddog-gov.com`  | US           |
| AP1     | `https://ap1.datadoghq.com` | `ap1.datadoghq.com` | Japan        |
| AP2     | `https://ap2.datadoghq.com` | `ap2.datadoghq.com` | Australia    |
| UK1     | `https://uk1.datadoghq.com` | `uk1.datadoghq.com` | UK           |

If you have a custom domain, such as `demo.datadoghq.com`, you can find your site listed at the top of the My Preferences page.

{% image
   source="https://docs.dd-static.net/images/getting_started/site/site-in-preferences.b76f275f6c237de6db1cf8d5fc70200e.png?auto=format&fit=max&w=850 1x, https://docs.dd-static.net/images/getting_started/site/site-in-preferences.b76f275f6c237de6db1cf8d5fc70200e.png?auto=format&fit=max&w=850&dpr=2 2x"
   alt="The top of the My Preferences page in Datadog, showing the organization name and site URL" /%}

To navigate to My Preferences, click your profile avatar in the lower-left corner, then select My Preferences from the menu.

{% image
   source="https://docs.dd-static.net/images/getting_started/site/my-preferences-menu.7b9de53f79382f4130a9a7413695cea7.png?auto=format&fit=max&w=850 1x, https://docs.dd-static.net/images/getting_started/site/my-preferences-menu.7b9de53f79382f4130a9a7413695cea7.png?auto=format&fit=max&w=850&dpr=2 2x"
   alt="The Datadog account menu, accessed by clicking your profile avatar in the lower-left navigation, showing the My Preferences option under Personal Settings" /%}

To send data to more than one destination through multiple endpoints, see the [Dual Shipping](https://docs.datadoghq.com/agent/configuration/dual-shipping.md) guide.

## SDK domains{% #sdk-domains %}

See [Supported endpoints for SDK domains](https://docs.datadoghq.com/real_user_monitoring.md#supported-endpoints-for-sdk-domains).

## Navigate the Datadog documentation by site{% #navigate-the-datadog-documentation-by-site %}

Different Datadog sites may support different functionalities depending on the instance's security requirements. Therefore, documentation may vary between sites. You can use the site selector dropdown menu on the right side of any page in the Datadog documentation to select the Datadog site you want to see information about.

{% image
   source="https://docs.dd-static.net/images/getting_started/site/site-selector-gs-with-tags.114ad048d1bb5d00b32108dd45b4207f.png?auto=format&fit=max&w=850 1x, https://docs.dd-static.net/images/getting_started/site/site-selector-gs-with-tags.114ad048d1bb5d00b32108dd45b4207f.png?auto=format&fit=max&w=850&dpr=2 2x"
   alt="The site selector dropdown menu on the right hand side of the Documentation site" /%}

For example, to see the documentation for the Datadog for Government sites, select US1-FED or US2-FED.

## Access the Datadog for Government sites{% #access-the-datadog-for-government-sites %}

### US1-FED{% #us1-fed %}

The Datadog for Government site (US1-FED) is Datadog's FedRAMP High Certified site. US1-FED is meant to allow US government agencies and partners to monitor their applications and infrastructure. For information about US1-FED security and compliance controls and frameworks, as well as how it supports FedRAMP, see the [Security page](https://www.datadoghq.com/security/).

### US2-FED{% #us2-fed %}

The Datadog for Government site (US2-FED) is In Process for IL5 Authorization. US2-FED is meant to allow US government agencies and partners to monitor their applications and infrastructure. For more information, email [fedramp@datadoghq.com](mailto:fedramp@datadoghq.com).

## Further Reading{% #further-reading %}

Additional helpful documentation, links, and articles:

- [Create Business-Critical Insights Using Dashboards and SLOs](https://learn.datadoghq.com/courses/dashboards-slos)
- [Dual Shipping](https://docs.datadoghq.com/agent/configuration/dual-shipping.md)
