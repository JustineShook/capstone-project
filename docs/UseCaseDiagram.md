# VeResc Use Case Diagram

```mermaid
flowchart LR
    Owner[Vehicle Owner]
    Mechanic[Onsite Mechanic]
    Towing[Towing Company]
    Shop[Home Garage / Shop Owner]
    Admin[Administrator]
    Cloudinary[Cloudinary]
    Device[Phone / SMS App]

    subgraph VeResc[VeResc Mobile Application]
        UC1([Register / Sign in])
        UC2([Manage owner profile])
        UC3([Manage vehicles])
        UC4([Complete account verification])
        UC5([Upload verification documents])
        UC6([Browse service providers])
        UC7([Book onsite mechanic])
        UC8([Book towing service])
        UC9([Request shop service and await approval])
        UC10([Track booking status])
        UC11([Rate completed service])
        UC12([Call or SMS provider])
        UC13([View notifications])
        UC14([Manage provider profile])
        UC15([Review service requests])
        UC16([Accept, decline, or update booking status])
        UC17([Review verification documents])
        UC18([Approve or reject verification])
    end

    Owner --> UC1
    Owner --> UC2
    Owner --> UC3
    Owner --> UC4
    Owner --> UC6
    Owner --> UC7
    Owner --> UC8
    Owner --> UC9
    Owner --> UC10
    Owner --> UC11
    Owner --> UC12
    Owner --> UC13

    Mechanic --> UC1
    Mechanic --> UC4
    Mechanic --> UC14
    Mechanic --> UC15
    Mechanic --> UC16
    Mechanic --> UC12
    Mechanic --> UC13

    Towing --> UC1
    Towing --> UC4
    Towing --> UC14
    Towing --> UC15
    Towing --> UC16
    Towing --> UC12
    Towing --> UC13

    Shop --> UC1
    Shop --> UC4
    Shop --> UC14
    Shop --> UC15
    Shop --> UC16
    Shop --> UC12
    Shop --> UC13

    Admin --> UC17
    Admin --> UC18

    UC4 -. includes .-> UC5
    UC7 -. includes .-> UC3
    UC8 -. includes .-> UC3
    UC9 -. includes .-> UC3
    UC11 -. extends .-> UC10
    UC5 --> Cloudinary
    UC12 --> Device
```

## Actors

| Actor | Main responsibilities |
| --- | --- |
| Vehicle Owner | Maintains vehicles, verifies their account, requests mechanic/towing/shop services, tracks and rates bookings. |
| Onsite Mechanic | Verifies provider account, reviews mechanic requests, updates service progress, contacts customers. |
| Towing Company | Verifies company account, reviews towing requests, updates towing progress, contacts customers. |
| Home Garage / Shop Owner | Verifies the shop, manages services, reviews requests, accepts or rejects them, and updates accepted service status. |
| Administrator | Reviews verification submissions and approves or rejects provider/owner verification. |
| Cloudinary | Stores uploaded verification documents and returns secure URLs. |
| Phone / SMS App | Handles direct calls and SMS; VeResc has no separate in-app messaging feature. |

## Current implementation note

## Auto shop request and approval flow

1. A vehicle owner chooses an available, verified auto shop, selects a saved vehicle, describes the issue, and reviews the request.
2. VeResc creates a pending request in Firestore. The request includes the vehicle snapshot, issue description, customer location, and the shop location and indicative starting price captured at submission.
3. The shop reviews the request and accepts or rejects it. The shop must be verified and open to accept.
4. If accepted, the customer brings the vehicle to the shop. The shop updates progress through Vehicle Arrived, Diagnosing, Repairing, and Completed. The customer can follow status updates from the request detail screen.
5. The final repair cost is agreed after the shop assesses the vehicle; the displayed starting price is not a final bill.

This is a request and approval process, not a scheduled appointment: customers do not choose a date or time, and an accepted request does not reserve a time slot. The app currently implements this shop flow with Firestore-backed requests and live status updates. The mechanic and towing bookings, ratings, and notifications have separate implementation status and may still use mock or partial services.
