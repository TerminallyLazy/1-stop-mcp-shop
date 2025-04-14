#!/usr/bin/env python3

from fastmcp import FastMCP, Context
import httpx
from typing import List, Optional

# Initialize FastMCP server
mcp = FastMCP("Weather Server", dependencies=["httpx"])

# Constants
NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0"


async def make_nws_request(url: str) -> Optional[dict]:
    """Helper function for making NWS API requests"""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json",
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        print(f"Error making NWS request: {e}")
        return None


def format_alert(feature: dict) -> str:
    """Format alert data"""
    props = feature.get("properties", {})
    return "\n".join([
        f"Event: {props.get('event', 'Unknown')}",
        f"Area: {props.get('areaDesc', 'Unknown')}",
        f"Severity: {props.get('severity', 'Unknown')}",
        f"Status: {props.get('status', 'Unknown')}",
        f"Headline: {props.get('headline', 'No headline')}",
        "---",
    ])


@mcp.tool()
async def get_alerts(state: str) -> str:
    """Get weather alerts for a state (two-letter state code, e.g. CA, NY)"""
    state_code = state.upper()
    alerts_url = f"{NWS_API_BASE}/alerts?area={state_code}"
    alerts_data = await make_nws_request(alerts_url)

    if not alerts_data:
        return "Failed to retrieve alerts data"

    features = alerts_data.get("features", [])
    if not features:
        return f"No active alerts for {state_code}"

    formatted_alerts = [format_alert(feature) for feature in features]
    return f"Active alerts for {state_code}:\n\n" + "\n".join(formatted_alerts)


@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get weather forecast for a location
    
    Args:
        latitude: Latitude of the location (-90 to 90)
        longitude: Longitude of the location (-180 to 180)
    """
    # Get grid point data
    points_url = f"{NWS_API_BASE}/points/{latitude:.4f},{longitude:.4f}"
    points_data = await make_nws_request(points_url)

    if not points_data:
        return f"Failed to retrieve grid point data for coordinates: {latitude}, {longitude}. This location may not be supported by the NWS API (only US locations are supported)."

    forecast_url = points_data.get("properties", {}).get("forecast")
    if not forecast_url:
        return "Failed to get forecast URL from grid point data"

    # Get forecast data
    forecast_data = await make_nws_request(forecast_url)
    if not forecast_data:
        return "Failed to retrieve forecast data"

    periods = forecast_data.get("properties", {}).get("periods", [])
    if not periods:
        return "No forecast periods available"

    # Format forecast periods
    formatted_forecast = []
    for period in periods:
        period_text = "\n".join([
            f"{period.get('name', 'Unknown')}:",
            f"Temperature: {period.get('temperature', 'Unknown')}°{period.get('temperatureUnit', 'F')}",
            f"Wind: {period.get('windSpeed', 'Unknown')} {period.get('windDirection', '')}",
            f"{period.get('shortForecast', 'No forecast available')}",
            "---"
        ])
        formatted_forecast.append(period_text)

    return f"Forecast for {latitude}, {longitude}:\n\n" + "\n".join(formatted_forecast)


@mcp.resource("weather://alerts/{state}")
async def alerts_resource(state: str) -> str:
    """Get weather alerts for a state as a resource"""
    return await get_alerts(state)


@mcp.resource("weather://forecast/{latitude}/{longitude}")
async def forecast_resource(latitude: float, longitude: float) -> str:
    """Get weather forecast for a location as a resource"""
    return await get_forecast(latitude, longitude)


if __name__ == "__main__":
    mcp.run()